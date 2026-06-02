# HumanRecognition Worker - Setup Guide

**Loyiha**: WorkPlus + HumanRecognition Integration
**Maqsad**: Real-vaqt odam aniqlash, yuz matching, va unknown person management
**Optima**: 16GB RAM, 6GB VRAM uchun (YOLOv8n + FaceNet512)

---

## 📋 Tizim Arxitekturasi

```
┌─────────────────────────────────────────────────────────────────┐
│                      WorkPlus Backend (FastAPI)                 │
│                                                                 │
│  GET /internal/cameras/active  ← Worker kameraları yuklaydi   │
│  POST /internal/camera-detections ← Worker detection yuboradi │
│  WebSocket /ws/employee-location ← Real-vaqt broadcast        │
│                                                                 │
│  API: /unknown-persons/* ← Admin: unknown persons linking      │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│               HumanRecognition Worker (Python)                  │
│                                                                 │
│  Har kamera uchun thread:                                      │
│  1. RTSP stream → OpenCV → Frame olish                         │
│  2. YOLOv8n → Face detection                                  │
│  3. FaceNet512 → Embedding extraction (512-dim vector)        │
│  4. Employee database → Matching (Euclidean distance)         │
│  5. Unknown person → Clustering                               │
│  6. API → Detection event yuborish                            │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                     IP Kameralar (RTSP)                        │
│                                                                 │
│  - Hikvision, Dahua, va boshqa ONVIF-compliant kameralar    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Installation & Setup

### 1️⃣ Database Migration'larini Apply Qilish

```bash
# BackendDir'da
cd Backend

# Migration'larni apply qilish (6-chi migration: face embeddings)
psql -U workplus -d workplus_db -f migrations/006_face_embeddings_and_unknowns.sql
```

### 2️⃣ Backend'ni Update Qilish

#### a) Router'ni ro'yxatiga qo'shish

**Backend/api/router.py** faylga quyidagini qo'shing:

```python
from api.routers import unknown_persons

# ... boshqa routers'lar ...

app.include_router(unknown_persons.router, prefix="/api")
```

#### b) Services'ni update qilish

AI camera service'nida unknown person handling qo'shilsin:

```python
# services/ai_camera_service.py'da

from services.unknown_person_service import find_or_create_unknown_person

# record_detection_event() funksiyasida:
if not data.employee_id:
    # Unknown person handling
    unknown_id, linked_emp = find_or_create_unknown_person(
        cur,
        cluster_id=data.track_id,  # Or compute from embedding
        embedding=data.bbox.get("embedding"),  # If sent from worker
        snapshot_path=data.snapshot_path,
    )
```

### 3️⃣ Worker'ni Setup Qilish

#### a) Requirements'ni o'rnatish

```bash
# Worker directory'da
pip install -r requirements_worker.txt

# GPU support uchun (CUDA 12.x)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# YOLOv8 face detection models'ni yuklash
python -c "from ultralytics import YOLO; YOLO('yolov8n-face.pt')"

# InsightFace models'ni yuklash
python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l').prepare(ctx_id=0)"
```

#### b) .env file'ni Configure Qilish

```bash
cp .env.example.worker .env

# .env'ni edit qilish:
WORKPLUS_API_URL=http://localhost:8000
AI_CAMERA_AGENT_TOKEN=your-32-byte-secure-token-here
WORKER_DEVICE=cuda
WORKER_VRAM_LIMIT_GB=6
```

#### c) Worker'ni Boshlash

```bash
# Single command
python human_recognition_worker.py

# Yoki background (systemd)
sudo systemctl start human_recognition_worker

# Yoki docker
docker-compose -f docker-compose.worker.yml up -d
```

---

## 🔧 Configuration Details

### GPU/VRAM Optimization (6GB uchun)

```python
# human_recognition_worker.py'da

DEVICE = "cuda"  # NVIDIA GPU
VRAM_LIMIT_GB = 6

# Model choices (small):
YOLO_MODEL = "yolov8n-face.pt"  # Nano - 2GB
# NOT: yolov8m-face.pt (Medium - 4GB) yoki yolov8l (Large - 6GB)

# Batch size
BATCH_SIZE = 1  # Frame-by-frame processing

# Frame skip
FRAME_SKIP = 2  # Har 2-frame'ni qayta ishlash
```

### Face Detection Thresholds

```python
FACE_DETECTION_THRESHOLD = 0.5  # 50% confidence minimum
FACE_SIZE_MIN = 50  # Pixels - juda kichik yuzlarni ignore

EMBEDDING_DISTANCE_THRESHOLD = 0.6  # Euclidean distance
FACE_MATCH_CONFIDENCE_MIN = 0.7  # 70% match confidence
```

### Unknown Person Clustering

```python
UNKNOWN_CLUSTER_DISTANCE = 0.5  # Shunga o'xshash embeddings -> same cluster
# Agar embedding distance <= 0.5 bo'lsa, bitta unknown person deb hisoblash

# Cleanup
UNKNOWN_CLEANUP_DAYS = 7  # 7 kundan ko'atra ko'rilmagan unknowns'ni delete
```

---

## 📱 Frontend Integration

### Admin Panel - Unknown Persons Page

```typescript
// React/Vue component
const UnknownPersonsPage = () => {
  const [unknowns, setUnknowns] = useState([])

  // 1. Unlinked unknown persons'ni yuklash
  const loadUnlinkedUnknowns = async () => {
    const resp = await fetch('/api/unknown-persons/unlinked?limit=50')
    setUnknowns(await resp.json())
  }

  // 2. Admin unknown person'ni click qilsa
  const onViewUnknown = async (unknownId) => {
    const details = await fetch(`/api/unknown-persons/${unknownId}`)
    // Show sample snapshot, recent detections
  }

  // 3. Admin "Bu kim?" deb employee select qilsa
  const onLinkToEmployee = async (unknownId, employeeId) => {
    const result = await fetch(
      `/api/unknown-persons/${unknownId}/link-to-employee/${employeeId}`,
      { method: 'POST' }
    )
    // Tarihni retroaktiv link qilish qo'llaniladi
  }

  return (
    <div>
      <h2>Unknown Persons ({unknowns.length})</h2>
      {unknowns.map(u => (
        <div key={u.id}>
          <img src={u.sample_snapshot} />
          <p>Seen {u.detection_count} times</p>
          <select onChange={e => onLinkToEmployee(u.id, e.target.value)}>
            <option>Select Employee...</option>
            {/* employees list */}
          </select>
        </div>
      ))}
    </div>
  )
}
```

---

## 🔍 Monitoring & Debugging

### Worker Logs'ni Ko'rish

```bash
# Real-time logs
tail -f human_recognition_worker.log

# Last 100 lines
tail -100 human_recognition_worker.log

# Error'larni filter
grep "❌" human_recognition_worker.log
```

### System Health Check

```bash
# GPU memory
nvidia-smi

# CPU/RAM usage
ps aux | grep human_recognition_worker

# Network requests to API
tcpdump -i any -A 'tcp port 8000'
```

### API Test

```bash
# Kameralarni test qilish
curl -H "Authorization: Bearer $AI_CAMERA_AGENT_TOKEN" \
  http://localhost:8000/internal/cameras/active

# Detection event yuborish
curl -X POST http://localhost:8000/internal/camera-detections \
  -H "Authorization: Bearer $AI_CAMERA_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "camera_id": "cam-123",
    "employee_id": "emp-456",
    "track_id": "track-1",
    "detection_type": "FACE_BODY",
    "confidence": 0.94,
    "bbox": {"x": 100, "y": 50, "w": 80, "h": 120}
  }'
```

---

## 🚨 Troubleshooting

### "CUDA out of memory"

```python
# Solution 1: Batch size kamaytar
BATCH_SIZE = 1  # O'rnatilgan

# Solution 2: Frame skip oshirish
FRAME_SKIP = 4  # 4 frame skip qilish

# Solution 3: Model kichiklashtirish
YOLO_MODEL = "yolov8n-face.pt"  # Nano modelni ishlatish
```

### "RTSP stream timeout"

```python
# Timeout'ni oshirish
cv2.VideoCapture(rtsp_url).set(cv2.CAP_PROP_BUFFERSIZE, 1)

# Network check
ping -c 1 <camera-ip>
```

### "Unknown persons'ni link qila olmaydu"

```bash
# 1. Migrationni check qilish
psql -U workplus -d workplus_db -c "\dt unknown_persons"

# 2. API token'ni verify qilish
echo $AI_CAMERA_AGENT_TOKEN | wc -c  # Min 32 chars

# 3. Backend logs'ni check qilish
tail -f Backend/logs/api.log
```

---

## 📊 Performance Expectations

| Metric | 6GB VRAM | 10GB VRAM |
|--------|----------|----------|
| Cameras (parallel) | 2-4 | 6-8 |
| FPS per camera | 15-20 | 25-30 |
| Face detection latency | 100-150ms | 50-100ms |
| Embedding extraction | 30-50ms | 20-30ms |
| Matching latency | 5-10ms | 5-10ms |

---

## 🔐 Security Notes

1. **AI_CAMERA_AGENT_TOKEN** - Minimal 32 bytes
2. **Database** - Face embeddings encrypted qilinishi tavsiya (pgp_sym_encrypt)
3. **RTSP** - Camera credentials secure HTTPS orqali yuborilsin
4. **API** - Rate limiting qo'shing unknown person linking uchun

---

## 🔄 Future Improvements

- [ ] Multi-face embedding averaging (bitta employee uchun 10+ rasm)
- [ ] Real-time embedding update (yangi xodimlar qo'shilganda)
- [ ] Body-only matching (yuz ko'rinmagan holatlar)
- [ ] Attention mechanism (most confident detection select)
- [ ] Privacy mode (unknown persons'ni blur qilish)
- [ ] WebGL-based embedding visualization

---

## 📞 Support

- Issues: GitHub issues'ga post qilish
- Logs: `human_recognition_worker.log` va `/api/unknown-persons/...`
- Monitoring: `/api/cameras/media-gateway/status` uchun health check

