# AI Camera Worker

This worker analyzes camera frames every few seconds and stores employee camera detections in the backend.

Pipeline:

```text
RTSP camera/NVR -> frame every N seconds -> YOLO person detection -> ReID match -> backend /internal/camera-detections
```

## Install

Use a GPU-capable Python environment when possible.

```bash
pip install -r agents/requirements-ai-camera.txt
```

Keep these dependencies separate from `Backend/requirements.txt`. The backend only stores detections and serves API traffic; YOLO, Torch, and ReID should live in the worker environment so the API server stays small and portable.

## Backend Token

Set the same secret on the backend and worker:

```env
AI_CAMERA_AGENT_TOKEN=at-least-32-bytes-secret
```

The backend already exposes:

- `GET /internal/cameras/active`
- `POST /internal/camera-detections`

Both endpoints require `Authorization: Bearer <AI_CAMERA_AGENT_TOKEN>`.

## ReID Gallery

Body ReID needs body images, not only face portraits. Put full-body or camera-like enrollment images here:

```text
reid_gallery/
  employee-uuid-1/
    front.jpg
    side.jpg
  employee-uuid-2/
    front.jpg
```

The folder name must be the employee UUID from the database.

## Run

Create `agents/.env` from `agents/ai_camera_worker.env.example`, then run:

```bash
python agents/ai_camera_worker.py
```

One test cycle:

```bash
python agents/ai_camera_worker.py --once
```

Recommended defaults:

- `AI_CAMERA_ANALYSIS_INTERVAL_SECONDS=3`
- `AI_CAMERA_ANALYSIS_PROFILE=main` for better ReID quality
- `AI_CAMERA_ANALYSIS_WORKERS=4` to start; increase carefully

For 100 cameras, use a dedicated GPU server if running YOLO/ReID continuously. The worker samples frames; it does not transcode video.
