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
from typing import Any, Optional, Dict, List, Tuple
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

# Windows cp1251 konsolда emoji loglar yiqilmasligi uchun UTF-8 ga o'tkazamiz
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("human_recognition_worker.log", encoding="utf-8"),
    ],
)

# WorkPlus API sozlamalari (auth yo'q — localhost'da backend bilan birga ishlaydi)
API_BASE = os.getenv("WORKPLUS_API_URL", "http://localhost:8001").rstrip("/")
GO2RTC_RTSP_BASE = os.getenv("GO2RTC_RTSP_URL", "rtsp://localhost:8554")
SNAPSHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Backend", "face_captures")
SNAPSHOT_WEB_PREFIX = "/static/face_captures"
API_TIMEOUT = 15
os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp|stimeout;5000000")

# GPU/VRAM sozlamalari
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
VRAM_LIMIT_GB = 6
logger.info(f"🖥️  Device: {DEVICE}")
if DEVICE == "cuda":
    logger.info(f"💾 VRAM limit: {VRAM_LIMIT_GB}GB")

# Model sozlamalari (6GB VRAM uchun)
YOLO_MODEL = os.getenv("WORKER_PERSON_MODEL", "yolov8l.pt")
POSE_MODEL = None  # Faolasini: yolov8n-pose.pt (agar kerak bo'lsa)
FACE_DETECTION_THRESHOLD = 0.5
PERSON_CLASS_ID = int(os.getenv("WORKER_PERSON_CLASS_ID", "0"))
BODY_DETECTION_THRESHOLD = float(os.getenv("WORKER_PERSON_DETECTION_THRESHOLD", "0.50"))
PERSON_IMGSZ = int(os.getenv("WORKER_PERSON_IMGSZ", "2400"))
BODY_SIZE_MIN = int(os.getenv("WORKER_PERSON_MIN_SIZE", "40"))
BODY_MAX_DETECTIONS = int(os.getenv("WORKER_PERSON_MAX_DETECTIONS", "20"))
TRACK_IOU_THRESHOLD = float(os.getenv("WORKER_TRACK_IOU_THRESHOLD", "0.2"))
TRACK_CENTER_DISTANCE = float(os.getenv("WORKER_TRACK_CENTER_DISTANCE", "160"))
TRACK_STALE_SECONDS = float(os.getenv("WORKER_TRACK_STALE_SECONDS", "4"))
DETECTION_SEND_INTERVAL_SECONDS = float(os.getenv("WORKER_DETECTION_SEND_INTERVAL_SECONDS", "1"))
FRAME_SKIP = max(1, int(os.getenv("WORKER_FRAME_SKIP", "3" if DEVICE == "cpu" else "2")))
YOLO_INTERVAL = int(os.getenv("WORKER_YOLO_INTERVAL", "3"))  # har N processed frameda bir YOLO
CROSSING_COOLDOWN_SECONDS = float(os.getenv("WORKER_CROSSING_COOLDOWN_SECONDS", "3"))
CROSSING_SIDE_EPSILON = float(os.getenv("WORKER_CROSSING_SIDE_EPSILON", "0.003"))
ROOM_PRESENCE_EXIT_CONFIRM_SECONDS = float(os.getenv("WORKER_ROOM_PRESENCE_EXIT_CONFIRM_SECONDS", "4"))

# Embedding sozlamalari
EMBEDDING_DIM = 512  # FaceNet512 / InsightFace buffalo_l
EMBEDDING_DISTANCE_THRESHOLD = 0.6  # (eski) Euclidean
FACE_MATCH_COSINE_MIN = float(os.getenv("FACE_MATCH_COSINE_MIN", "0.35"))  # cosine o'xshashlik chegarasi
EMBEDDING_REFRESH_SECONDS = int(os.getenv("WORKER_EMBEDDING_REFRESH_SECONDS", "300"))  # embeddinglarni qayta yuklash
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
    track_id: Optional[str] = None


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


@dataclass
class PendingRoomExit:
    track_id: str
    pending_at: datetime
    detection: Detection


class RoomPresenceTrackState:
    """Track bo'yicha room-presence pending exit holatini ushlab turadi."""

    def __init__(self):
        self.pending_exits: Dict[str, PendingRoomExit] = {}

    def mark_pending_exit(self, track_id: str, detection: Detection, pending_at: datetime):
        self.pending_exits[track_id] = PendingRoomExit(track_id, pending_at, detection)

    def cancel_pending_exit(self, track_id: str) -> Optional[PendingRoomExit]:
        return self.pending_exits.pop(track_id, None)

    def pending_exit(self, track_id: str) -> Optional[PendingRoomExit]:
        return self.pending_exits.get(track_id)

    def active_tracks_to_cancel(self, active_track_ids: set[str], now: datetime) -> list[PendingRoomExit]:
        due: list[PendingRoomExit] = []
        for track_id in active_track_ids:
            pending = self.pending_exits.get(track_id)
            if pending and (now - pending.pending_at).total_seconds() >= ROOM_PRESENCE_EXIT_CONFIRM_SECONDS:
                due.append(pending)
        return due


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
            self.face_model.conf = BODY_DETECTION_THRESHOLD
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

    def detect_people(self, frame: np.ndarray) -> List[Detection]:
        """Frame'da odamlarni aniqlash."""
        if not self.face_model:
            self.load_face_detector()

        try:
            fh, fw = frame.shape[0], frame.shape[1]
            results = self.face_model(
                frame,
                conf=BODY_DETECTION_THRESHOLD,
                classes=[PERSON_CLASS_ID],
                imgsz=PERSON_IMGSZ,
                verbose=False,
            )
            detections = []

            for result in results:
                for box in result.boxes:
                    conf = float(box.conf)
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    w, h = x2 - x1, y2 - y1
                    if w < BODY_SIZE_MIN or h < BODY_SIZE_MIN:
                        continue

                    body_crop = frame[max(0, y1):min(frame.shape[0], y2),
                                     max(0, x1):min(frame.shape[1], x2)]
                    detections.append(
                        Detection(
                            detection_type="BODY",
                            confidence=conf,
                            bbox={
                                "x": int(x1),
                                "y": int(y1),
                                "w": int(w),
                                "h": int(h),
                                "fw": fw,
                                "fh": fh,
                            },
                            face_snapshot=body_crop,
                        )
                    )

            detections.sort(key=lambda item: item.confidence, reverse=True)
            return detections[:BODY_MAX_DETECTIONS]
        except Exception as e:
            logger.error(f"Person detection error: {e}")
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

    def _refresh_embeddings(self, force: bool = False):
        """Backend'dan barcha xodim embedding'larini yuklab, cosine uchun normalizatsiya qiladi."""
        if (
            not force
            and self.last_update
            and (datetime.now() - self.last_update).total_seconds() < EMBEDDING_REFRESH_SECONDS
        ):
            return
        try:
            response = requests.get(
                f"{API_BASE}/internal/face-embeddings",
                timeout=API_TIMEOUT,
            )
            response.raise_for_status()
            rows = response.json().get("data", [])

            grouped: Dict[str, List[np.ndarray]] = {}
            for row in rows:
                emp_id = row.get("employee_id")
                vec = np.asarray(row.get("embedding") or [], dtype=np.float32)
                if emp_id is None or vec.size == 0:
                    continue
                norm = np.linalg.norm(vec)
                if norm == 0:
                    continue
                grouped.setdefault(emp_id, []).append(vec / norm)  # L2-normalized

            self.employee_embeddings = grouped
            self.last_update = datetime.now()
            logger.info(
                f"🔄 Embeddings refreshed: {len(grouped)} employees, "
                f"{sum(len(v) for v in grouped.values())} vectors"
            )
        except Exception as e:
            logger.error(f"❌ Failed to refresh embeddings: {e}")

    def find_best_employee_match(
        self,
        embedding: List[float],
        min_similarity: float = FACE_MATCH_COSINE_MIN,
    ) -> Optional[Tuple[str, float]]:
        """
        Embedding'ni xodim yuzlariga cosine o'xshashlik bilan taqqoslaydi.
        (InsightFace embeddinglari normalizatsiyalangan — cosine to'g'ri o'lchov.)
        Qaytaradi: (employee_id, similarity) yoki None.
        """
        if not embedding or not self.employee_embeddings:
            return None

        query = np.asarray(embedding, dtype=np.float32)
        q_norm = np.linalg.norm(query)
        if q_norm == 0:
            return None
        query = query / q_norm

        best_employee = None
        best_similarity = -1.0

        for employee_id, vectors in self.employee_embeddings.items():
            for emp_vec in vectors:
                similarity = float(np.dot(query, emp_vec))  # cosine (ikkalasi normalized)
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_employee = employee_id

        if best_employee and best_similarity >= min_similarity:
            return (best_employee, best_similarity)

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
        crossing_rule: Optional[Dict] = None,
    ):
        self.camera_id = camera_id
        self.camera_name = camera_name
        self.rtsp_url = rtsp_url
        self.model_manager = model_manager
        self.matching_engine = matching_engine
        self.crossing_rule = crossing_rule if crossing_rule and crossing_rule.get("enabled") else None

        self.cap = None
        self.active_tracks: Dict[str, Track] = {}
        self.last_sent_by_track: Dict[str, datetime] = {}
        self.track_snapshots: Dict[str, str] = {}
        self.track_sides: Dict[str, int] = {}
        self.last_crossing_by_track: Dict[str, datetime] = {}
        self.room_presence_state = RoomPresenceTrackState()
        self.next_track_id = 0
        self.cv_trackers: Dict[str, Any] = {}   # track_id → OpenCV tracker
        self.yolo_frame_count = 0               # processed frame counter
        self.stop_event = Event()
        self.thread = None

        self.stats = {
            "frames_processed": 0,
            "persons_detected": 0,
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

    def _open_capture(self) -> bool:
        if self.cap:
            self.cap.release()
        self.cap = cv2.VideoCapture(self.rtsp_url, cv2.CAP_FFMPEG)
        try:
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass
        return bool(self.cap and self.cap.isOpened())

    def _run(self):
        """Main loop"""
        while not self.stop_event.is_set() and not self._open_capture():
            logger.error(f"❌ Failed to open camera: {self.camera_name}")
            self.stats["errors"] += 1
            time.sleep(5)

        frame_skip = FRAME_SKIP
        frame_count = 0
        consecutive_read_errors = 0

        while not self.stop_event.is_set():
            ret, frame = self.cap.read()
            if not ret:
                logger.warning(f"⚠️  Frame read error: {self.camera_name}")
                self.stats["errors"] += 1
                consecutive_read_errors += 1
                if consecutive_read_errors >= 5:
                    logger.warning(f"Reconnecting camera stream: {self.camera_name}")
                    self._open_capture()
                    consecutive_read_errors = 0
                time.sleep(1)
                continue

            consecutive_read_errors = 0
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

    @staticmethod
    def _bbox_iou(first: Dict, second: Dict) -> float:
        ax1 = float(first.get("x", 0))
        ay1 = float(first.get("y", 0))
        ax2 = ax1 + float(first.get("w", 0))
        ay2 = ay1 + float(first.get("h", 0))
        bx1 = float(second.get("x", 0))
        by1 = float(second.get("y", 0))
        bx2 = bx1 + float(second.get("w", 0))
        by2 = by1 + float(second.get("h", 0))

        inter_w = max(0.0, min(ax2, bx2) - max(ax1, bx1))
        inter_h = max(0.0, min(ay2, by2) - max(ay1, by1))
        intersection = inter_w * inter_h
        if intersection <= 0:
            return 0.0

        first_area = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
        second_area = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
        union = first_area + second_area - intersection
        if union <= 0:
            return 0.0
        return intersection / union

    @staticmethod
    def _center_distance(first: Dict, second: Dict) -> float:
        ax = float(first.get("x", 0)) + float(first.get("w", 0)) / 2
        ay = float(first.get("y", 0)) + float(first.get("h", 0)) / 2
        bx = float(second.get("x", 0)) + float(second.get("w", 0)) / 2
        by = float(second.get("y", 0)) + float(second.get("h", 0)) / 2
        return float(np.hypot(ax - bx, ay - by))

    def _match_track(self, detection: Detection, used_track_ids: set[str]) -> Optional[str]:
        best_iou = 0.0
        best_iou_track = None
        best_distance = float("inf")
        best_distance_track = None

        for track_id, track in self.active_tracks.items():
            if track_id in used_track_ids or not track.detections:
                continue

            last_bbox = track.detections[-1].bbox
            iou = self._bbox_iou(detection.bbox, last_bbox)
            if iou > best_iou:
                best_iou = iou
                best_iou_track = track_id

            distance = self._center_distance(detection.bbox, last_bbox)
            if distance < best_distance:
                best_distance = distance
                best_distance_track = track_id

        if best_iou_track and best_iou >= TRACK_IOU_THRESHOLD:
            return best_iou_track
        if best_distance_track and best_distance <= TRACK_CENTER_DISTANCE:
            return best_distance_track
        return None

    def _assign_tracks(self, detections: List[Detection], now: datetime) -> set[str]:
        active_track_ids: set[str] = set()

        for detection in sorted(detections, key=lambda item: item.bbox.get("x", 0)):
            track_id = self._match_track(detection, active_track_ids)
            if not track_id:
                self.next_track_id += 1
                track_id = f"body-{self.next_track_id:06d}"
                self.active_tracks[track_id] = Track(
                    track_id=track_id,
                    detection_type=detection.detection_type,
                    first_seen=now,
                    last_seen=now,
                )

            track = self.active_tracks[track_id]
            detection.track_id = track_id
            track.detections.append(detection)
            track.last_seen = now
            active_track_ids.add(track_id)

        return active_track_ids

    def _should_send_track(self, track_id: str, now: datetime) -> bool:
        last_sent = self.last_sent_by_track.get(track_id)
        if last_sent and (now - last_sent).total_seconds() < DETECTION_SEND_INTERVAL_SECONDS:
            return False
        self.last_sent_by_track[track_id] = now
        return True

    def _expire_tracks(self, now: datetime, active_track_ids: set[str]):
        for track_id, track in list(self.active_tracks.items()):
            if track_id in active_track_ids:
                continue
            if (now - track.last_seen).total_seconds() <= TRACK_STALE_SECONDS:
                continue

            last_detection = track.detections[-1] if track.detections else None
            if last_detection:
                last_detection.track_id = track_id
                self._send_detection(
                    None,
                    last_detection,
                    confidence=last_detection.confidence,
                    seen_at=track.last_seen,
                    disappeared_at=now,
                )
                pending_exit = self.room_presence_state.pending_exit(track_id)
                if pending_exit and (now - pending_exit.pending_at).total_seconds() >= ROOM_PRESENCE_EXIT_CONFIRM_SECONDS:
                    self._send_room_presence_exit_confirmation(
                        track_id=track_id,
                        exited_at=pending_exit.pending_at,
                    )

            self.active_tracks.pop(track_id, None)
            self.last_sent_by_track.pop(track_id, None)
            self.track_snapshots.pop(track_id, None)
            self.cv_trackers.pop(track_id, None)
            self.track_sides.pop(track_id, None)
            self.last_crossing_by_track.pop(track_id, None)
            self.room_presence_state.cancel_pending_exit(track_id)

    @staticmethod
    def _normalized_center(bbox: Dict) -> Tuple[float, float]:
        fw = max(1.0, float(bbox.get("fw") or 1))
        fh = max(1.0, float(bbox.get("fh") or 1))
        cx = (float(bbox.get("x", 0)) + float(bbox.get("w", 0)) / 2) / fw
        cy = (float(bbox.get("y", 0)) + float(bbox.get("h", 0)) / 2) / fh
        return min(1.0, max(0.0, cx)), min(1.0, max(0.0, cy))

    @staticmethod
    def _line_side(rule: Dict, point: Tuple[float, float]) -> int:
        x1 = float(rule.get("line_x1", 0.5))
        y1 = float(rule.get("line_y1", 0.1))
        x2 = float(rule.get("line_x2", 0.5))
        y2 = float(rule.get("line_y2", 0.9))
        px, py = point
        cross = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)
        if abs(cross) < CROSSING_SIDE_EPSILON:
            return 0
        return 1 if cross > 0 else -1

    def _check_crossing(self, detection: Detection, now: datetime):
        rule = self.crossing_rule
        if not rule or not detection.track_id:
            return

        side = self._line_side(rule, self._normalized_center(detection.bbox))
        if side == 0:
            return

        previous_side = self.track_sides.get(detection.track_id)
        self.track_sides[detection.track_id] = side
        if previous_side is None or previous_side == side:
            return

        last_crossing = self.last_crossing_by_track.get(detection.track_id)
        if last_crossing and (now - last_crossing).total_seconds() < CROSSING_COOLDOWN_SECONDS:
            return
        self.last_crossing_by_track[detection.track_id] = now

        crossing_direction = (
            "negative_to_positive" if previous_side < side else "positive_to_negative"
        )
        direction = (
            "entry"
            if crossing_direction == rule.get("entry_direction", "negative_to_positive")
            else "exit"
        )
        self._send_crossing_event(
            detection=detection,
            direction=direction,
            crossing_direction=crossing_direction,
            crossed_at=now,
        )
        if direction == "exit":
            self.room_presence_state.mark_pending_exit(detection.track_id, detection, now)
        else:
            pending = self.room_presence_state.cancel_pending_exit(detection.track_id)
            if pending:
                self._send_room_presence_exit_cancel(detection.track_id)

    @staticmethod
    def _make_cv_tracker():
        """OpenCV versiyasiga qarab to'g'ri tracker yaratish."""
        try:
            return cv2.TrackerKCF_create()
        except AttributeError:
            return cv2.legacy.TrackerKCF_create()  # type: ignore[attr-defined]

    def _reinit_tracker(self, track_id: str, frame: np.ndarray, bbox: Dict):
        """Mavjud yoki yangi OpenCV tracker ni bbox bilan ishga tushirish."""
        fh, fw = frame.shape[:2]
        x = max(0, int(bbox.get("x", 0)))
        y = max(0, int(bbox.get("y", 0)))
        w = max(1, min(int(bbox.get("w", 10)), fw - x))
        h = max(1, min(int(bbox.get("h", 10)), fh - y))
        try:
            tracker = self._make_cv_tracker()
            if tracker.init(frame, (x, y, w, h)):
                self.cv_trackers[track_id] = tracker
        except Exception:
            self.cv_trackers.pop(track_id, None)

    def _run_cv_trackers(self, frame: np.ndarray, now: datetime):
        """YOLO o'rniga OpenCV trackerlardan detection list yasash."""
        detections: List[Detection] = []
        active_track_ids: set = set()
        fh, fw = frame.shape[:2]

        for track_id in list(self.cv_trackers):
            tracker = self.cv_trackers[track_id]
            ok, rect = tracker.update(frame)
            if not ok:
                self.cv_trackers.pop(track_id, None)
                continue

            x, y, w, h = max(0, int(rect[0])), max(0, int(rect[1])), int(rect[2]), int(rect[3])
            w = min(w, fw - x)
            h = min(h, fh - y)
            if w <= 2 or h <= 2:
                self.cv_trackers.pop(track_id, None)
                continue

            track = self.active_tracks.get(track_id)
            if not track:
                self.cv_trackers.pop(track_id, None)
                continue

            crop = frame[y: y + h, x: x + w]
            prev_conf = track.detections[-1].confidence if track.detections else 0.5
            det = Detection(
                detection_type="BODY",
                confidence=prev_conf,
                bbox={"x": x, "y": y, "w": w, "h": h, "fw": fw, "fh": fh},
                face_snapshot=crop if crop.size > 0 else None,
                track_id=track_id,
            )
            track.detections.append(det)
            track.last_seen = now
            active_track_ids.add(track_id)
            detections.append(det)

        return detections, active_track_ids

    def _emit_detections(self, detections: List[Detection], now: datetime):
        """Crossing check + API ga yuborish (YOLO va tracker framelar uchun umumiy)."""
        if not detections:
            return
        self.stats["persons_detected"] += len(detections)
        for det in detections:
            if det.track_id:
                self._check_crossing(det, now)
            if not det.track_id or not self._should_send_track(det.track_id, now):
                continue
            self.stats["unknowns_detected"] += 1
            self._send_detection(None, det, confidence=det.confidence, seen_at=now)

    def _process_frame(self, frame: np.ndarray):
        """YOLO + OpenCV tracker kombinatsiyasi."""
        self.yolo_frame_count += 1
        now = datetime.now()

        run_yolo = (self.yolo_frame_count % YOLO_INTERVAL == 1) or (not self.active_tracks)

        if run_yolo:
            # --- YOLO detection (GPU) ---
            detections = self.model_manager.detect_people(frame)
            active_track_ids = self._assign_tracks(detections, now)

            # Yangi/yangilangan tracklarni reinit qilish
            for track_id in active_track_ids:
                track = self.active_tracks.get(track_id)
                if track and track.detections:
                    self._reinit_tracker(track_id, frame, track.detections[-1].bbox)

            # Yo'qolgan trackerlarni tozalash
            for tid in list(self.cv_trackers):
                if tid not in active_track_ids:
                    self.cv_trackers.pop(tid, None)
        else:
            # --- OpenCV tracker (CPU, tez) ---
            detections, active_track_ids = self._run_cv_trackers(frame, now)

        # Umumiy: room presence, expire, send
        for pending in self.room_presence_state.active_tracks_to_cancel(active_track_ids, now):
            self.room_presence_state.cancel_pending_exit(pending.track_id)
            self._send_room_presence_exit_cancel(pending.track_id)

        self._expire_tracks(now, active_track_ids)
        self._emit_detections(detections, now)

    def _save_snapshot(self, track_id: str, img: np.ndarray) -> Optional[str]:
        """Snapshot ni disk ga saqlash, web path qaytarish (faqat birinchi marta)."""
        if track_id in self.track_snapshots:
            return self.track_snapshots[track_id]
        try:
            os.makedirs(SNAPSHOT_DIR, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            safe_cam = self.camera_id.replace("-", "")[:12]
            filename = f"worker_{safe_cam}_{track_id}_{ts}.jpg"
            filepath = os.path.join(SNAPSHOT_DIR, filename)
            cv2.imwrite(filepath, img)
            web_path = f"{SNAPSHOT_WEB_PREFIX}/{filename}"
            self.track_snapshots[track_id] = web_path
            return web_path
        except Exception as e:
            logger.debug(f"Snapshot save error: {e}")
            return None

    def _send_detection(
        self,
        employee_id: Optional[str],
        detection: Detection,
        confidence: Optional[float] = None,
        unknown_cluster_id: Optional[str] = None,
        seen_at: Optional[datetime] = None,
        disappeared_at: Optional[datetime] = None,
    ):
        """Detection eventini API'ga yuborish"""
        try:
            track_id = unknown_cluster_id or employee_id or detection.track_id or "unknown"
            event_confidence = detection.confidence if confidence is None else confidence

            # Snapshot: faqat birinchi marta, disappeared bo'lsa saqlamaymiz
            snapshot_path: Optional[str] = None
            if not disappeared_at and detection.face_snapshot is not None and track_id:
                snapshot_path = self._save_snapshot(track_id, detection.face_snapshot)

            payload = {
                "camera_id": self.camera_id,
                "employee_id": employee_id,
                "track_id": track_id,
                "detection_type": detection.detection_type,
                "confidence": min(1.0, max(0, event_confidence)),
                "bbox": detection.bbox,
                "seen_at": (seen_at or datetime.now()).isoformat(),
                "snapshot_path": snapshot_path,
            }
            if disappeared_at:
                payload["disappeared_at"] = disappeared_at.isoformat()

            response = requests.post(
                f"{API_BASE}/internal/camera-detections",
                json=payload,
                timeout=API_TIMEOUT,
            )
            response.raise_for_status()

        except requests.RequestException as e:
            logger.warning(f"⚠️  Failed to send detection to API: {e}")


    def _send_crossing_event(
        self,
        detection: Detection,
        direction: str,
        crossing_direction: str,
        crossed_at: Optional[datetime] = None,
        employee_id: Optional[str] = None,
    ):
        """Line crossing eventini API'ga yuborish."""
        try:
            payload = {
                "camera_id": self.camera_id,
                "employee_id": employee_id,
                "track_id": detection.track_id or "unknown",
                "direction": direction,
                "crossing_direction": crossing_direction,
                "confidence": min(1.0, max(0, detection.confidence)),
                "bbox": detection.bbox,
                "crossed_at": (crossed_at or datetime.now()).isoformat(),
                "snapshot_path": None,
            }
            response = requests.post(
                f"{API_BASE}/internal/camera-crossings",
                json=payload,
                timeout=API_TIMEOUT,
            )
            response.raise_for_status()
            logger.info(
                f"Crossing {direction}: {self.camera_name} "
                f"track={payload['track_id']} dir={crossing_direction}"
            )
        except requests.RequestException as e:
            logger.warning(f"Failed to send crossing to API: {e}")

    def _send_room_presence_exit_confirmation(self, track_id: str, exited_at: datetime):
        """Pending exit'ni room presence tarixida yakuniy chiqish qilib yopish."""
        try:
            response = requests.post(
                f"{API_BASE}/internal/camera-room-presence/confirm-exit",
                json={
                    "camera_id": self.camera_id,
                    "track_id": track_id,
                    "exited_at": exited_at.isoformat(),
                },
                timeout=API_TIMEOUT,
            )
            response.raise_for_status()
            logger.info(f"Room presence exit confirmed: {self.camera_name} track={track_id}")
        except requests.RequestException as e:
            logger.warning(f"Failed to confirm room presence exit: {e}")

    def _send_room_presence_exit_cancel(self, track_id: str):
        """Track hali ko'rinyapti yoki qaytdi: pending exit'ni bekor qilish."""
        try:
            response = requests.post(
                f"{API_BASE}/internal/camera-room-presence/cancel-exit",
                json={
                    "camera_id": self.camera_id,
                    "track_id": track_id,
                },
                timeout=API_TIMEOUT,
            )
            response.raise_for_status()
            logger.info(f"Room presence exit cancelled: {self.camera_name} track={track_id}")
        except requests.RequestException as e:
            logger.warning(f"Failed to cancel room presence exit: {e}")


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

    def _cleanup_stale_tracks(self):
        """Worker start bo'lganda DB dagi eski "live" tracklarni tozalash."""
        try:
            token = os.getenv("AI_CAMERA_AGENT_TOKEN", "")
            response = requests.post(
                f"{API_BASE}/internal/expire-stale-tracks?stale_seconds=120",
                headers={"X-Camera-Agent-Token": token},
                timeout=API_TIMEOUT,
            )
            response.raise_for_status()
            logger.info(f"🧹 Stale tracks expired: {response.json().get('message')}")
        except Exception as e:
            logger.warning(f"⚠️  Stale track cleanup failed: {e}")

    def start(self):
        """Worker'ni ishga tushirish"""
        logger.info("🚀 HumanRecognition Worker starting...")
        self.status["started_at"] = datetime.now()

        # Eski "live" tracklarni tozalash
        self._cleanup_stale_tracks()

        # Kameralarni API'dan yuklash
        self._load_cameras()

        # Monitoring loop
        self._monitor()

    def _load_cameras(self):
        """API'dan kamera ro'yxatini yuklash va stream'larni boshlash"""
        try:
            response = requests.get(
                f"{API_BASE}/internal/cameras/active",
                timeout=API_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()

            cameras_list = data.get("data", [])
            logger.info(f"📹 Loaded {len(cameras_list)} cameras from API")

            for cam_data in cameras_list:
                camera_id = cam_data["id"]
                camera_name = cam_data["name"]
                rtsp_url = f"{GO2RTC_RTSP_BASE}/cam-{camera_id}"

                handler = CameraStreamHandler(
                    camera_id=camera_id,
                    camera_name=camera_name,
                    rtsp_url=rtsp_url,
                    model_manager=self.model_manager,
                    matching_engine=self.matching_engine,
                    crossing_rule=cam_data.get("crossing_rule"),
                )
                handler.start()
                self.cameras[camera_id] = handler

            self.status["cameras_active"] = len(self.cameras)
            logger.info(f"✅ {len(self.cameras)} camera streams active")

        except Exception as e:
            logger.error(f"❌ Failed to load cameras: {e}")
            self.status["errors"] += 1

    def _refresh_camera_rules(self):
        """API'dan crossing rule sozlamalarini yangilab turish."""
        try:
            response = requests.get(
                f"{API_BASE}/internal/cameras/active",
                timeout=API_TIMEOUT,
            )
            response.raise_for_status()
            for cam_data in response.json().get("data", []):
                handler = self.cameras.get(cam_data.get("id"))
                if not handler:
                    continue
                rule = cam_data.get("crossing_rule")
                handler.crossing_rule = rule if rule and rule.get("enabled") else None
        except Exception as e:
            logger.warning(f"Failed to refresh camera crossing rules: {e}")

    def _monitor(self):
        """Monitoring loop"""
        while not self.stop_event.is_set():
            try:
                time.sleep(30)  # Har 30 sekundda report

                # Embeddinglarni davriy yangilash (yangi enroll qilingan xodimlar uchun)
                self.matching_engine._refresh_embeddings()
                self._refresh_camera_rules()

                total_frames = sum(h.stats["frames_processed"] for h in self.cameras.values())
                total_people = sum(h.stats["persons_detected"] for h in self.cameras.values())
                total_matched = sum(h.stats["employees_matched"] for h in self.cameras.values())
                total_unknowns = sum(h.stats["unknowns_detected"] for h in self.cameras.values())

                logger.info(
                    f"📊 Stats - Frames: {total_frames}, "
                    f"People: {total_people}, "
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
