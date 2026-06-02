# 🚀 HumanRecognition + WorkPlus Integration - Quick Start

**5 minutes da ishga tushirish uchun:**

---

## Step 1: Backend Migration (1 min)

```bash
cd Backend
psql -U workplus -d workplus_db -f migrations/006_face_embeddings_and_unknowns.sql
```

✅ Database'da `unknown_persons`, `employee_face_embeddings` jadvallar yaratildi.

---

## Step 2: Backend Router'ni Register Qilish (2 min)

**Backend/main.py** faylga quyidagini qo'shing:

```python
from api.routers import unknown_persons

# ... existing routers ...

# Add this line:
app.include_router(unknown_persons.router, prefix="/api")
```

Backend'ni restart qilish:
```bash
cd Backend
python main.py
```

✅ `/api/unknown-persons/*` endpoints ishga tushdi.

---

## Step 3: Worker Setup & Run (2 min)

### Option A: Direct Python (Development)

```bash
# Dependencies
pip install -r requirements_worker.txt

# Models yuklash (first time)
python -c "from ultralytics import YOLO; YOLO('yolov8n-face.pt')"
python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l').prepare(ctx_id=0)"

# Configure
cp .env.example.worker .env
# Edit .env: set AI_CAMERA_AGENT_TOKEN = your 32-byte token

# Run
python human_recognition_worker.py
```

### Option B: Docker (Production)

```bash
# Build
docker build -f Dockerfile.worker -t human-recognition-worker:latest .

# Run
docker run --gpus all \
  -e WORKPLUS_API_URL=http://localhost:8000 \
  -e AI_CAMERA_AGENT_TOKEN=your-token \
  human-recognition-worker:latest
```

### Option C: Docker Compose

```bash
docker-compose -f docker-compose.worker.yml up -d
```

✅ Worker kameralardan odam aniqlash boshlanadi.

---

## Step 4: Verify Everything Works

### Check 1: Worker is running
```bash
# Logs
tail -f human_recognition_worker.log

# Should see:
# ✅ Face detector loaded
# ✅ FaceNet512 loaded
# 📹 Loaded X cameras from API
# ▶️  Camera stream started: Camera_1
```

### Check 2: API is responding
```bash
curl http://localhost:8000/api/unknown-persons/unlinked
# Should return: {"meta": {...}, "data": [...]}
```

### Check 3: Database
```sql
SELECT COUNT(*) FROM camera_detection_events WHERE employee_id IS NULL;
-- Should have increasing count (unknown detections)

SELECT * FROM unknown_persons LIMIT 5;
-- Should show detected unknown persons
```

---

## 📱 Using the Admin Panel

### View Unknown Persons
```
Navigate to: http://localhost:3000/admin/unknown-persons
```

You'll see:
- Unknown person's sample snapshot
- How many times detected
- Last seen time & camera
- Recent detections timeline

### Link Unknown Person to Employee

1. Click on unknown person
2. Select employee name from dropdown
3. Click "Link"
4. ✅ Person will be retroactively linked to that employee
   - All old detections updated
   - History synced
   - Unknown person marked as resolved

---

## 🎯 Real-World Example

**Timeline:**

```
10:00 AM - New employee (Oleg) joins company
           Camera sees face first time → "unknown_persons" table

10:15 AM - Oleg walks past cameras → detections keep increasing
           Still marked as unknown

2:00 PM - Admin opens "Unknown Persons" panel
          Sees Oleg's face with 15 detections
          Admin clicks "Link to Employee" → selects "Oleg"
          
2:00:02 PM - System:
             1. Sets unknown_persons.linked_employee_id = oleg_id
             2. Retroactively updates ALL 15 old detections
             3. camera_detection_events.employee_id = oleg_id
             4. Audit trail: "LINKED by admin at 2:00 PM"
             
2:00:03 PM - Oleg is now known
             3:00 PM - New detections automatically match Oleg
             Productivity tracking starts working
             Attendance reports include Oleg
```

---

## 🔧 Configuration Tuning

### For Different Server Specs

**Light setup (4GB VRAM):**
```
YOLO_MODEL = "yolov8n-face.pt"  # Keep nano
WORKER_FRAME_SKIP = 4  # Skip more frames
FACE_SIZE_MIN = 100  # Ignore small faces
```

**Heavy setup (12GB VRAM):**
```
YOLO_MODEL = "yolov8m-face.pt"  # Medium
WORKER_FRAME_SKIP = 1  # Process every frame
FACE_SIZE_MIN = 30  # Detect smaller faces
```

---

## 🐛 Debugging

### Worker not detecting people?

1. **Check GPU:**
   ```bash
   nvidia-smi
   # Should show python process using VRAM
   ```

2. **Check stream:**
   ```bash
   ffplay rtsp://camera-ip:554/stream
   # Should show live video
   ```

3. **Check detections:**
   ```sql
   SELECT COUNT(*) FROM camera_detection_events;
   -- Count should increase over time
   ```

### Unknown persons not syncing?

1. **API token:**
   ```bash
   echo $AI_CAMERA_AGENT_TOKEN | wc -c
   # Should be 32+ characters
   ```

2. **API health:**
   ```bash
   curl http://localhost:8000/internal/cameras/active
   # Should return camera list
   ```

3. **Database:**
   ```sql
   SELECT * FROM unknown_persons LIMIT 1;
   -- Should have entries
   ```

---

## 📊 Monitoring

### Quick Stats

```bash
# Detections per hour
sqlite3 human_recognition_worker.log "SELECT COUNT(*) FROM detections WHERE timestamp > datetime('now', '-1 hour')"

# Top cameras
SELECT camera_name, COUNT(*) as detections 
FROM camera_detection_events 
GROUP BY camera_id 
ORDER BY detections DESC;

# Unknown vs Known ratio
SELECT 
  SUM(CASE WHEN employee_id IS NULL THEN 1 ELSE 0 END) as unknown,
  SUM(CASE WHEN employee_id IS NOT NULL THEN 1 ELSE 0 END) as known
FROM camera_detection_events
WHERE seen_at > NOW() - INTERVAL '1 day';
```

---

## ✅ Checklist

- [ ] Database migration applied
- [ ] Backend router registered
- [ ] Worker installed & configured
- [ ] GPU/CUDA working
- [ ] Models downloaded
- [ ] Worker started (no errors)
- [ ] Unknown persons appearing in DB
- [ ] Admin panel accessible
- [ ] Unknown person linking works
- [ ] History retroactively updated

---

## 🎓 Next Steps

1. **Tweak thresholds** - Adjust `FACE_MATCH_CONFIDENCE_MIN` for your environment
2. **Pre-build embeddings** - Extract embeddings for all existing employees (faster matching)
3. **Add more cameras** - Scale to 4-8 cameras with 6GB VRAM
4. **Set up monitoring** - Prometheus metrics + Grafana dashboard
5. **Privacy features** - Blur unknown faces in live streams

---

## 📞 Support

- Logs: `human_recognition_worker.log`
- API Status: `GET /api/cameras/media-gateway/status`
- Worker Status: Check process `ps aux | grep human_recognition_worker`

**Tabriklashni! Hazir sistemangiz ishlayapti!** 🎉
