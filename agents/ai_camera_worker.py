from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import requests
from ultralytics import YOLO

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None


LOGGER = logging.getLogger("ai-camera-worker")


@dataclass(frozen=True)
class CameraConfig:
    id: str
    name: str
    rtsp_url: str


@dataclass(frozen=True)
class PersonDetection:
    bbox: dict[str, int]
    confidence: float
    crop: np.ndarray


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def l2_normalize(vector: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vector))
    if norm <= 0:
        return vector
    return vector / norm


class BackendClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {token}"})

    def list_cameras(self) -> list[CameraConfig]:
        response = self.session.get(f"{self.base_url}/internal/cameras/active", timeout=15)
        response.raise_for_status()
        items = response.json().get("data", [])
        profile = env("AI_CAMERA_ANALYSIS_PROFILE", "main").lower()
        cameras = []
        for item in items:
            rtsp_url = item.get("rtsp_main_url")
            if profile == "sub" and item.get("rtsp_sub_url"):
                rtsp_url = item["rtsp_sub_url"]
            if not rtsp_url:
                continue
            cameras.append(CameraConfig(id=item["id"], name=item["name"], rtsp_url=rtsp_url))
        return cameras

    def post_detection(
        self,
        camera_id: str,
        detection: PersonDetection,
        employee_id: str | None,
        track_id: str,
        snapshot_path: str | None = None,
    ) -> None:
        payload = {
            "camera_id": camera_id,
            "employee_id": employee_id,
            "track_id": track_id,
            "detection_type": "BODY",
            "confidence": detection.confidence,
            "bbox": detection.bbox,
            "snapshot_path": snapshot_path,
        }
        response = self.session.post(
            f"{self.base_url}/internal/camera-detections",
            json=payload,
            timeout=15,
        )
        response.raise_for_status()


class YoloPersonDetector:
    def __init__(self, model_name: str, confidence: float):
        self.model = YOLO(model_name)
        self.confidence = confidence

    def detect(self, frame: np.ndarray) -> list[PersonDetection]:
        results = self.model.predict(frame, conf=self.confidence, classes=[0], verbose=False)
        detections: list[PersonDetection] = []
        height, width = frame.shape[:2]
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                score = float(box.conf[0])
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                x1 = max(0, min(x1, width - 1))
                x2 = max(0, min(x2, width - 1))
                y1 = max(0, min(y1, height - 1))
                y2 = max(0, min(y2, height - 1))
                if x2 <= x1 or y2 <= y1:
                    continue
                crop = frame[y1:y2, x1:x2].copy()
                detections.append(
                    PersonDetection(
                        bbox={"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1},
                        confidence=score,
                        crop=crop,
                    )
                )
        return detections


class ReIdMatcher:
    def __init__(self, gallery_dir: Path, threshold: float):
        self.gallery_dir = gallery_dir
        self.threshold = threshold
        self.extractor = self._build_extractor()
        self.gallery: dict[str, np.ndarray] = {}
        self.reload_gallery()

    def _build_extractor(self):
        try:
            from torchreid.utils import FeatureExtractor
        except Exception as exc:
            raise RuntimeError(
                "torchreid o'rnatilmagan. agents/requirements-ai-camera.txt ni o'rnating."
            ) from exc

        model_name = env("AI_CAMERA_REID_MODEL", "osnet_x1_0")
        model_path = env("AI_CAMERA_REID_MODEL_PATH")
        device = env("AI_CAMERA_REID_DEVICE", "cuda")
        if device == "cuda":
            try:
                import torch

                if not torch.cuda.is_available():
                    device = "cpu"
            except Exception:
                device = "cpu"
        return FeatureExtractor(model_name=model_name, model_path=model_path or "", device=device)

    def reload_gallery(self) -> None:
        if not self.gallery_dir.exists():
            LOGGER.warning("ReID gallery dir topilmadi: %s", self.gallery_dir)
            return

        vectors: dict[str, list[np.ndarray]] = {}
        for image_path in self.gallery_dir.rglob("*"):
            if image_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                continue
            employee_id = image_path.parent.name
            image = cv2.imread(str(image_path))
            if image is None:
                continue
            embedding = self.embed(image)
            vectors.setdefault(employee_id, []).append(embedding)

        self.gallery = {
            employee_id: l2_normalize(np.mean(items, axis=0))
            for employee_id, items in vectors.items()
            if items
        }
        LOGGER.info("ReID gallery loaded: %s employees", len(self.gallery))

    def embed(self, image_bgr: np.ndarray) -> np.ndarray:
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        features = self.extractor([image_rgb])
        if hasattr(features, "detach"):
            features = features.detach().cpu().numpy()
        return l2_normalize(np.asarray(features[0], dtype=np.float32))

    def match(self, crop: np.ndarray) -> tuple[str | None, float]:
        if not self.gallery:
            return None, 0.0
        embedding = self.embed(crop)
        best_employee_id = None
        best_score = -1.0
        for employee_id, gallery_embedding in self.gallery.items():
            score = float(np.dot(embedding, gallery_embedding))
            if score > best_score:
                best_score = score
                best_employee_id = employee_id
        if best_score < self.threshold:
            return None, best_score
        return best_employee_id, best_score


def read_frame(rtsp_url: str) -> np.ndarray | None:
    capture = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
    try:
        capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        ok, frame = capture.read()
        if not ok:
            return None
        return frame
    finally:
        capture.release()


def stable_track_id(camera_id: str, bbox: dict[str, int], employee_id: str | None) -> str:
    bucket = int(time.time() // int(env("AI_CAMERA_TRACK_BUCKET_SECONDS", "30")))
    raw = json.dumps(
        {
            "camera_id": camera_id,
            "employee_id": employee_id,
            "bucket": bucket,
            "x": bbox["x"] // 40,
            "y": bbox["y"] // 40,
        },
        sort_keys=True,
    )
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:24]


def process_camera(
    camera: CameraConfig,
    detector: YoloPersonDetector,
    matcher: ReIdMatcher,
    backend: BackendClient,
) -> int:
    frame = read_frame(camera.rtsp_url)
    if frame is None:
        LOGGER.warning("Frame olinmadi: %s (%s)", camera.name, camera.id)
        return 0

    detections = detector.detect(frame)
    posted = 0
    for detection in detections:
        employee_id, reid_score = matcher.match(detection.crop)
        confidence = min(1.0, max(detection.confidence, reid_score))
        detection = PersonDetection(
            bbox=detection.bbox,
            confidence=confidence,
            crop=detection.crop,
        )
        track_id = stable_track_id(camera.id, detection.bbox, employee_id)
        backend.post_detection(camera.id, detection, employee_id, track_id)
        posted += 1
    return posted


def run_once(
    backend: BackendClient,
    detector: YoloPersonDetector,
    matcher: ReIdMatcher,
    max_workers: int,
) -> int:
    cameras = backend.list_cameras()
    total = 0
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(process_camera, camera, detector, matcher, backend)
            for camera in cameras
        ]
        for future in as_completed(futures):
            try:
                total += future.result()
            except Exception:
                LOGGER.exception("Camera analysis failed")
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="WorkPlus YOLO + ReID camera worker")
    parser.add_argument("--once", action="store_true", help="Run one analysis cycle and exit")
    args = parser.parse_args()

    if load_dotenv:
        load_dotenv(Path(__file__).with_name(".env"))
        load_dotenv(Path.cwd() / "Backend" / ".env")
        load_dotenv(Path.cwd() / ".env")

    logging.basicConfig(
        level=env("AI_CAMERA_WORKER_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(message)s",
    )

    backend_url = env("AI_CAMERA_BACKEND_URL", "http://127.0.0.1:8000")
    agent_token = env("AI_CAMERA_AGENT_TOKEN")
    if not agent_token:
        raise SystemExit("AI_CAMERA_AGENT_TOKEN kerak")

    interval = float(env("AI_CAMERA_ANALYSIS_INTERVAL_SECONDS", "3"))
    max_workers = int(env("AI_CAMERA_ANALYSIS_WORKERS", "4"))
    yolo_model = env("AI_CAMERA_YOLO_MODEL", "yolov8n.pt")
    yolo_confidence = float(env("AI_CAMERA_YOLO_CONFIDENCE", "0.35"))
    reid_threshold = float(env("AI_CAMERA_REID_THRESHOLD", "0.72"))
    gallery_dir = Path(env("AI_CAMERA_REID_GALLERY_DIR", "reid_gallery"))

    backend = BackendClient(backend_url, agent_token)
    detector = YoloPersonDetector(yolo_model, yolo_confidence)
    matcher = ReIdMatcher(gallery_dir, reid_threshold)

    while True:
        started = time.monotonic()
        total = run_once(backend, detector, matcher, max_workers)
        LOGGER.info("Analysis cycle completed: %s detections", total)
        if args.once:
            return
        elapsed = time.monotonic() - started
        time.sleep(max(0.0, interval - elapsed))


if __name__ == "__main__":
    main()
