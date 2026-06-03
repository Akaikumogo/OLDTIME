#!/usr/bin/env python3
"""
Face enrollment - xodim rasmlaridan embedding yasab WorkPlus bazasiga yozadi.

Worker bilan AYNAN bir xil model (InsightFace buffalo_l) ishlatiladi —
aks holda taqqoslash masofalari mos kelmaydi.

Ishlatish:
    python enroll_faces.py --all              # mavjud barcha xodimlarni bir marta enroll qiladi
    python enroll_faces.py --watch            # yangi xodimlarni doimiy kuzatib enroll qiladi
    python enroll_faces.py --watch --interval 30
    python enroll_faces.py --all --replace    # eski embeddinglarni o'chirib qayta yozadi

Env:
    WORKPLUS_API_URL          (default http://localhost:8000)
    AI_CAMERA_AGENT_TOKEN     (majburiy, 32+ bayt)
"""

import argparse
import logging
import os
import sys
import time
from urllib.parse import urljoin

import cv2
import numpy as np
import requests

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("enroll")

API_BASE = os.getenv("WORKPLUS_API_URL", "http://localhost:8001").rstrip("/")
API_TIMEOUT = 20

# Auth yo'q — backend bilan bir serverda ishlaydi
HEADERS: dict = {}

# ---- InsightFace (worker bilan bir xil model) ----
try:
    from insightface.app import FaceAnalysis
except ImportError:
    logger.error("❌ insightface o'rnatilmagan. `pip install insightface onnxruntime` (yoki onnxruntime-gpu)")
    sys.exit(1)


def load_model():
    use_gpu = os.getenv("WORKER_DEVICE", "cuda").lower() == "cuda"
    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if use_gpu else ["CPUExecutionProvider"]
    app = FaceAnalysis(name="buffalo_l", providers=providers)
    app.prepare(ctx_id=0 if use_gpu else -1, det_size=(640, 640))
    logger.info(f"✅ InsightFace buffalo_l yuklandi ({'GPU' if use_gpu else 'CPU'})")
    return app


def resolve_photo_url(photo_url: str) -> str:
    """photo_url ni to'liq URL ga aylantiradi."""
    if photo_url.startswith(("http://", "https://")):
        return photo_url
    if photo_url.startswith("/"):
        return f"{API_BASE}{photo_url}"
    return urljoin(f"{API_BASE}/", photo_url)


def download_image(photo_url: str):
    """Rasmni yuklab numpy BGR ga aylantiradi."""
    url = resolve_photo_url(photo_url)
    resp = requests.get(url, timeout=API_TIMEOUT)
    resp.raise_for_status()
    buf = np.frombuffer(resp.content, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Rasmni o'qib bo'lmadi: {url}")
    return img


def extract_embedding(app, img):
    """Eng katta yuzni tanlab embedding qaytaradi. (embedding, det_score) yoki None."""
    faces = app.get(img)
    if not faces:
        return None
    # Eng katta yuz (bbox maydoni bo'yicha)
    def area(f):
        x1, y1, x2, y2 = f.bbox
        return (x2 - x1) * (y2 - y1)

    face = max(faces, key=area)
    embedding = np.asarray(face.embedding, dtype=np.float32).tolist()
    confidence = float(getattr(face, "det_score", 1.0))
    return embedding, min(1.0, max(0.0, confidence))


def fetch_pending():
    resp = requests.get(
        f"{API_BASE}/internal/employees/pending-enrollment",
        headers=HEADERS,
        timeout=API_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json().get("data", [])


def store_embedding(employee_id, embedding, snapshot_path, confidence, replace):
    payload = {
        "employee_id": employee_id,
        "embedding": embedding,
        "snapshot_path": snapshot_path,
        "confidence": confidence,
        "replace": replace,
    }
    resp = requests.post(
        f"{API_BASE}/internal/face-embeddings",
        json=payload,
        headers=HEADERS,
        timeout=API_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def enroll_once(app, replace: bool) -> int:
    """Navbatdagi barcha xodimlarni enroll qiladi. Enroll qilinganlar sonini qaytaradi."""
    pending = fetch_pending()
    if not pending:
        return 0

    logger.info(f"📋 Enroll navbatida {len(pending)} xodim")
    enrolled = 0
    for emp in pending:
        emp_id = emp["employee_id"]
        name = emp.get("full_name", "?")
        photo = emp.get("photo_url")
        try:
            img = download_image(photo)
            result = extract_embedding(app, img)
            if result is None:
                logger.warning(f"⚠️  Yuz topilmadi: {name} ({photo})")
                continue
            embedding, confidence = result
            store_embedding(emp_id, embedding, photo, confidence, replace)
            enrolled += 1
            logger.info(f"✅ Enroll: {name}  (conf={confidence:.2f})")
        except Exception as e:
            logger.error(f"❌ {name}: {e}")
    return enrolled


def main():
    parser = argparse.ArgumentParser(description="WorkPlus face enrollment")
    parser.add_argument("--all", action="store_true", help="Bir marta hamma navbatdagi xodimni enroll qilish")
    parser.add_argument("--watch", action="store_true", help="Yangi xodimlarni doimiy kuzatib enroll qilish")
    parser.add_argument("--interval", type=int, default=60, help="--watch rejimida tekshirish oralig'i (sekund)")
    parser.add_argument("--replace", action="store_true", help="Mavjud embeddinglarni o'chirib qayta yozish")
    args = parser.parse_args()

    if not args.all and not args.watch:
        parser.error("--all yoki --watch dan birini tanlang")

    app = load_model()

    if args.all:
        total = enroll_once(app, args.replace)
        logger.info(f"🏁 Tugadi. Jami {total} xodim enroll qilindi.")
        if not args.watch:
            return

    if args.watch:
        logger.info(f"👀 Watch rejimi boshlandi (har {args.interval}s)")
        while True:
            try:
                count = enroll_once(app, replace=False)
                if count:
                    logger.info(f"➕ {count} yangi xodim enroll qilindi")
            except Exception as e:
                logger.error(f"❌ Watch xatosi: {e}")
            time.sleep(args.interval)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("⏹️  To'xtatildi")
