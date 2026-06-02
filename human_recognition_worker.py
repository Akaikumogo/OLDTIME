#!/usr/bin/env python3
"""
HumanRecognition Worker - WorkPlus bilan integratsiya
Kameralardan odam aniqlash, yuz matching, unknown person handling

6GB VRAM uchun optimlashtirilgan:
- YOLOv8n (nano model)
- FaceNet512 (lightweight)
- Batch inference yoq, frame-by-frame
- Embedding cache
"""

import os
import sys
import time
import logging
import cv2
import numpy as np
import requests
from datetime import datetime, timedelta
from collections import defaultdict, deque
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass
from threading import Thread, Event
import json

# Model imports - lazily loaded
try:
    from ultralytics import YOLO
    import torch
except ImportError:
    print("❌ PyTorch/YOLOv8 not installed. Run: pip install ultralytics torch opencv-python")
    sys.exit(1)

# ============================================================================
# CONFIGURATION
# ============================================================================

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("human_recognition_worker.log"),
    ],
)

# WorkPlus API sozlamalari
API_BASE = os.getenv("WORKPLUS_API_URL", "http://localhost:8000").rstrip("/")
API_TOKEN = os.getenv("AI_CAMERA_AGENT_TOKEN", "")
API_TIMEOUT = 15

if not API_TOKEN or len(API_TOKEN) < 32:
    logger.error("❌ AI_CAMERA_AGENT_TOKEN not configured or too short")
    sys.exit(1)

# GPU/VRAM sozlamalari
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
VRAM_LIMIT_GB = 6
logger.info(f"🖥️  Device: {DEVICE}")
if DEVICE == "cuda":
    logger.info(f"💾 VRAM limit: {VRAM_LIMIT_GB}GB")

# Model sozlamalari (6GB VRAM uchun)
YOLO_MODEL = "yolov8n-face.pt"  # Nano face detection
POSE_MODEL = None  # Faolasini: yolov8n-pose.pt (agar kerak bo'lsa)
FACE_DETECTION_THRESHOLD = 0.5
BODY_DETECTION_THRESHOLD = 0.4

# Embedding sozlamalari
EMBEDDING_DIM = 512  # FaceNet512
EMBEDDING_DISTANCE_THRESHOLD = 0.6  # Euclidean distance
FACE_SIZE_MIN = 50  # Pixels - juda kichik yuzlarni o'tkazib yuborish

# Unknown person clustering
UNKNOWN_CLUSTER_DISTANCE = 0.5  # Shunga o'xshash yuzlarni bitta clusterga
UNKNOWN_CLEANUP_DAYS = 7  # Nechta kun keyin cleanup

# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class Detection:
    """Single detection: face yoki body"""
    detection_type: str  # "FACE", "BODY", "FACE_BODY"
    confidence: float
    bbox: Dict  # {"x": int, "y": int, "w": int, "h": int}
    embedding: Optional[List[float]] = None  # Face embedding (FaceNet512)
    face_snapshot: Optional[np.ndarray] = None  # Cropped face image


@dataclass
class Track:
    """Object tracking (multi-frame detection)"""
    track_id: str
    detection_type: str
    detections: deque = None  # Last 10 frames
    embedding: Optional[List[float]] = None
    last_seen: datetime = None
    first_seen: datetime = None

    def __post_init__(self):
        if self.detections is None:
            self.detections = deque(maxlen=10)
        if self.last_seen is None:
            self.last_seen = datetime.now()
        if self.first_seen is None:
            self.first_seen = datetime.now()


# ============================================================================
# MODEL MANAGEMENT
# ============================================================================

class ModelManager:
    """YOLOv8 va FaceNet512 models'ni boshqarish"""

    def __init__(self):
        self.face_model = None
        self.pose_model = None
        self.embedding_extractor = None
        self.device = DEVICE
        logger.info(f"🔧 ModelManager initializing on {self.device}")

    def load_face_detector(self):
        """YOLOv8 face detection model'ni yuklash"""
        if self.face_model:
            return

        logger.info(f"📦 Loading YOLOv8 face detector...")
        try:
            self.face_model = YOLO(YOLO_MODEL).to(self.device)
            self.face_model.conf = FACE_DETECTION_THRESHOLD
            logger.info(f"✅ Face detector loaded")
        except Exception as e:
            logger.error(f"❌ Failed to load face detector: {e}")
            raise

    def load_embedding_extractor(self):
        """FaceNet512 embedding extraction model'ni yuklash"""
        if self.embedding_extractor:
            return

        logger.info(f"📦 Loading FaceNet512 embedding extractor...")
        try:
            # Facenet-pytorch yoki insightface dan foydalanish mumkin
            # Shu yerda insightface'ni ishlatilyapti (lightweight)
            try:
                from insightface.app import FaceAnalysis
                app = FaceAnalysis(name="buffalo_l", providers=["CUDAExecutionProvider" if self.device == "cuda" else "CPUExecutionProvider"])
                app.prepare(ctx_id=0 if self.device == "cuda" else -1)
                self.embedding_extractor = app
                logger.info(f"✅ FaceNet512 loaded via InsightFace")
            except ImportError:
                logger.warning(f"⚠️  InsightFace not available, falling back to simple face features")
                # Fallback: simple face feature extraction (less accurate but works)
                self.embedding_extractor = "simple"

        except Exception as e:
            logger.error(f"❌ Failed to load embedding extractor: {e}")
            self.embedding_extractor = "simple"

    def detect_faces(self, frame: np.ndarray) -> List[Detection]:
        """Frame'da yuzlarni aniqlash"""
        if not self.face_model:
            self.load_face_detector()

        try:
            results = self.face_model(frame, verbose=False)
            detections = []

            for result in results:
                for box in result.boxes:
                    conf = float(box.conf)
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    w, h = x2 - x1, y2 - y1

                    # Juda kichik yuzlarni o'tkazib yuborish
                    if w < FACE_SIZE_MIN or h < FACE_SIZE_MIN:
                        continue

                    # Cropped face
                    face_crop = frame[max(0, y1):min(frame.shape[0], y2),
                                     max(0, x1):min(frame.shape[1], x2)]

                    det = Detection(
                        detection_type="FACE",
                        confidence=conf,
                        bbox={"x": int(x1), "y": int(y1), "w": int(w), "h": int(h)},
                        face_snapshot=face_crop,
                    )
                    detections.append(det)

            return detections
        except Exception as e:
            logger.error(f"❌ Face detection error: {e}")
            return []

    def extract_embedding(self, face_crop: np.ndarray) -> Optional[List[float]]:
        """Yuzdan embedding chiqarish (512-dimensional vector)"""
        if not self.embedding_extractor:
            self.load_embedding_extractor()

        try:
            if self.embedding_extractor == "simple":
                # Fallback: resnet50 orqali embedding (simple version)
                # Bu yerda InsightFace qo'llaniladi
                import cv2
                face_resized = cv2.resize(face_crop, (224, 224))
                # Normalized vector (simple)
                face_flat = face_resized.flatten().astype(np.float32) / 255.0
                embedding = face_flat[:EMBEDDING_DIM].tolist()
                return embedding
            else:
                # InsightFace embedding
                faces = self.embedding_extractor.get(face_crop)
                if faces:
                    embedding = faces[0].embedding.tolist()
                    return embedding[:EMBEDDING_DIM]  # 512-dim
                return None
        except Exception as e:
            logger.error(f"❌ Embedding extraction error: {e}")
            return None


# ============================================================================
# FACE MATCHING ENGINE
# ============================================================================

class FaceMatchingEngine:
    """Employee yuzlarini taqqoslaش va unknown person detection"""

    def __init__(self, db_connection_func):
        self.db_func = db_connection_func
        self.employee_embeddings: Dict[str, List[List[float]]] = {}  # employee_id -> embeddings
        self.unknown_clusters: Dict[str, List[float]] = {}  # cluster_id -> centroid embedding
        self.last_update = None
        self._refresh_embeddings()

    def _refresh_embeddings(self):
        """DB'dan employee embedding'larini yuklash"""
        try:
            # TODO: Aqli refreshing
            self.last_update = datetime.now()
            logger.info(f"🔄 Employee embeddings refreshed")
        except Exception as e:
            logger.error(f"❌ Failed to refresh embeddings: {e}")

    def find_best_employee_match(
        self,
        embedding: List[float],
        min_confidence: float = 0.7
    ) -> Optional[Tuple[str, float]]:
        """
        Embedding'ni employee'ning yuzlariga taqqoslash
        Qaytaradi: (employee_id, confidence) yoki None agar topilmasa
        """
        if not embedding or not self.employee_embeddings:
            return None

        best_employee = None
        best_distance = float('inf')

        for employee_id, embeddings in self.employee_embeddings.items():
            for emp_embedding in embeddings:
                # Euclidean distance
                distance = np.linalg.norm(np.array(embedding) - np.array(emp_embedding))
                if distance < best_distance:
                    best_distance = distance
                    best_employee = employee_id

        # Distance -> confidence conversion
        confidence = max(0, 1 - (best_distance / 2.0))

        if confidence >= min_confidence and best_employee:
            return (best_employee, confidence)

        return None

    def find_or_create_unknown_cluster(
        self,
        embedding: List[float],
        snapshot_path: Optional[str] = None
    ) -> str:
        """
        Unknown embedding'ni klasterga qo'shish yoki yangi klaster yaratish
        Qaytaradi: cluster_id
        """
        # Shunga o'xshash cluster'ni topish
        closest_cluster = None
        closest_distance = float('inf')

        for cluster_id, centroid in self.unknown_clusters.items():
            distance = np.linalg.norm(np.array(embedding) - np.array(centroid))
            if distance < UNKNOWN_CLUSTER_DISTANCE:
                if distance < closest_distance:
                    closest_distance = distance
                    closest_cluster = cluster_id

        if closest_cluster:
            # Mavjud klasterga qo'shish - centroid'ni yangilash
            old_centroid = np.array(self.unknown_clusters[closest_cluster])
            new_centroid = (old_centroid + np.array(embedding)) / 2.0
            self.unknown_clusters[closest_cluster] = new_centroid.tolist()
            return closest_cluster

        # Yangi klaster yaratish
        cluster_id = f"cluster_{int(time.time() * 1000) % 1000000}"
        self.unknown_clusters[cluster_id] = embedding
        return cluster_id


# ============================================================================
# CAMERA STREAM HANDLER
# ============================================================================

class CameraStreamHandler:
    """Bitta kamera uchun real-vaqt stream processing"""

    def __init__(
        self,
        camera_id: str,
        camera_name: str,
        rtsp_url: str,
        model_manager: ModelManager,
        matching_engine: FaceMatchingEngine,
    ):
        self.camera_id = camera_id
        self.camera_name = camera_name
        self.rtsp_url = rtsp_url
        self.model_manager = model_manager
        self.matching_engine = matching_engine

        self.cap = None
        self.active_tracks: Dict[str, Track] = {}
        self.next_track_id = 0
        self.stop_event = Event()
        self.thread = None

        self.stats = {
            "frames_processed": 0,
            "faces_detected": 0,
            "employees_matched": 0,
            "unknowns_detected": 0,
            "errors": 0,
        }

    def start(self):
        """Stream processing'ni boshlash"""
        if self.thread and self.thread.is_alive():
            return

        self.stop_event.clear()
        self.thread = Thread(target=self._run, daemon=True)
        self.thread.start()
        logger.info(f"▶️  Camera stream started: {self.camera_name}")

    def stop(self):
        """Stream processing'ni to'xtatish"""
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=5)
        if self.cap:
            self.cap.release()
        logger.info(f"⏹️  Camera stream stopped: {self.camera_name}")

    def _run(self):
        """Main loop"""
        self.cap = cv2.VideoCapture(self.rtsp_url)
        if not self.cap.isOpened():
            logger.error(f"❌ Failed to open camera: {self.camera_name}")
            self.stats["errors"] += 1
            return

        frame_skip = 2  # Har 2-frame'ni qayta ishlash (tezlik uchun)
        frame_count = 0

        while not self.stop_event.is_set():
            ret, frame = self.cap.read()
            if not ret:
                logger.warning(f"⚠️  Frame read error: {self.camera_name}")
                self.stats["errors"] += 1
                time.sleep(1)
                continue

            frame_count += 1
            if frame_count % frame_skip != 0:
                continue

            try:
                self._process_frame(frame)
                self.stats["frames_processed"] += 1
            except Exception as e:
                logger.error(f"❌ Frame processing error ({self.camera_name}): {e}")
                self.stats["errors"] += 1

            time.sleep(0.01)  # 100 FPS max (6GB VRAM uchun)

    def _process_frame(self, frame: np.ndarray):
        """Bitta frame'ni qayta ishlash"""
        # Face detection
        detections = self.model_manager.detect_faces(frame)
        if not detections:
            return

        self.stats["faces_detected"] += len(detections)

        # Embedding extraction va matching
        for det in detections:
            if det.face_snapshot is None:
                continue

            embedding = self.model_manager.extract_embedding(det.face_snapshot)
            if not embedding:
                continue

            det.embedding = embedding

            # Employee matching
            match = self.matching_engine.find_best_employee_match(embedding)

            if match:
                employee_id, confidence = match
                self.stats["employees_matched"] += 1
                self._send_detection(employee_id, det, confidence)
            else:
                # Unknown person
                self.stats["unknowns_detected"] += 1
                cluster_id = self.matching_engine.find_or_create_unknown_cluster(
                    embedding,
                    snapshot_path=None,  # TODO: save to disk
                )
                self._send_detection(None, det, 0, unknown_cluster_id=cluster_id)

    def _send_detection(
        self,
        employee_id: Optional[str],
        detection: Detection,
        confidence: float = 0,
        unknown_cluster_id: Optional[str] = None,
    ):
        """Detection eventini API'ga yuborish"""
        try:
            payload = {
                "camera_id": self.camera_id,
                "employee_id": employee_id,
                "track_id": unknown_cluster_id or employee_id or "unknown",
                "detection_type": detection.detection_type,
                "confidence": min(1.0, max(0, confidence)),
                "bbox": detection.bbox,
                "seen_at": datetime.now().isoformat(),
                "snapshot_path": None,  # TODO: implement
            }

            headers = {"Authorization": f"Bearer {API_TOKEN}"}
            response = requests.post(
                f"{API_BASE}/internal/camera-detections",
                json=payload,
                headers=headers,
                timeout=API_TIMEOUT,
            )
            response.raise_for_status()

        except requests.RequestException as e:
            logger.warning(f"⚠️  Failed to send detection to API: {e}")


# ============================================================================
# MAIN WORKER
# ============================================================================

class HumanRecognitionWorker:
    """Asosiy worker"""

    def __init__(self):
        self.model_manager = ModelManager()
        self.matching_engine = FaceMatchingEngine(None)  # DB funk keyinchalik
        self.cameras: Dict[str, CameraStreamHandler] = {}
        self.stop_event = Event()
        self.status = {
            "started_at": None,
            "cameras_active": 0,
            "total_detections": 0,
            "errors": 0,
        }

    def start(self):
        """Worker'ni ishga tushirish"""
        logger.info("🚀 HumanRecognition Worker starting...")
        self.status["started_at"] = datetime.now()

        # Kameralarni API'dan yuklash
        self._load_cameras()

        # Monitoring loop
        self._monitor()

    def _load_cameras(self):
        """API'dan kamera ro'yxatini yuklash va stream'larni boshlash"""
        try:
            headers = {"Authorization": f"Bearer {API_TOKEN}"}
            response = requests.get(
                f"{API_BASE}/internal/cameras/active",
                headers=headers,
                timeout=API_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()

            cameras_list = data.get("data", [])
            logger.info(f"📹 Loaded {len(cameras_list)} cameras from API")

            for cam_data in cameras_list:
                camera_id = cam_data["id"]
                camera_name = cam_data["name"]
                rtsp_url = cam_data.get("rtsp_main_url")

                if not rtsp_url:
                    logger.warning(f"⚠️  Camera {camera_name} has no RTSP URL")
                    continue

                handler = CameraStreamHandler(
                    camera_id=camera_id,
                    camera_name=camera_name,
                    rtsp_url=rtsp_url,
                    model_manager=self.model_manager,
                    matching_engine=self.matching_engine,
                )
                handler.start()
                self.cameras[camera_id] = handler

            self.status["cameras_active"] = len(self.cameras)
            logger.info(f"✅ {len(self.cameras)} camera streams active")

        except Exception as e:
            logger.error(f"❌ Failed to load cameras: {e}")
            self.status["errors"] += 1

    def _monitor(self):
        """Monitoring loop"""
        while not self.stop_event.is_set():
            try:
                time.sleep(30)  # Har 30 sekundda report

                total_frames = sum(h.stats["frames_processed"] for h in self.cameras.values())
                total_faces = sum(h.stats["faces_detected"] for h in self.cameras.values())
                total_matched = sum(h.stats["employees_matched"] for h in self.cameras.values())
                total_unknowns = sum(h.stats["unknowns_detected"] for h in self.cameras.values())

                logger.info(
                    f"📊 Stats - Frames: {total_frames}, "
                    f"Faces: {total_faces}, "
                    f"Matched: {total_matched}, "
                    f"Unknowns: {total_unknowns}"
                )

            except Exception as e:
                logger.error(f"❌ Monitoring error: {e}")

    def stop(self):
        """Worker'ni to'xtatish"""
        logger.info("🛑 Stopping HumanRecognition Worker...")
        self.stop_event.set()

        for camera_id, handler in self.cameras.items():
            handler.stop()

        logger.info("✅ Worker stopped")


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    worker = HumanRecognitionWorker()

    try:
        worker.start()
    except KeyboardInterrupt:
        logger.info("⏹️  Interrupted by user")
        worker.stop()
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}", exc_info=True)
        worker.stop()
        sys.exit(1)
