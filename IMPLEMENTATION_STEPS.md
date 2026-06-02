# Implementation Steps - HumanRecognition Integration

**Target**: Production-ready, 6GB VRAM, background operation

---

## Phase 0: Preparation (30 min)

### ✅ Step 0.1: Verify Infrastructure
```bash
# GPU check
nvidia-smi
# Should show: NVIDIA GPU with 6GB+ VRAM

# Python version
python --version
# Should be 3.10+

# PostgreSQL check
psql -U workplus -d workplus_db -c "SELECT 1"
# Should return: 1

# Camera connectivity
ping <camera-ip>
# Should respond

# API check
curl http://localhost:8000/docs
# Should show FastAPI Swagger UI
```

### ✅ Step 0.2: Generate API Token
```bash
# Generate 32-byte random token (base64)
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Output example:
# AbC1DeF2GhI3JkL4MnO5PqR6StU7VwX8YzA9BcD0EfG1HiJ2KlM3NoPqR

# Save it:
export AI_CAMERA_AGENT_TOKEN="AbC1DeF2GhI3JkL4MnO5PqR6StU7VwX8YzA9BcD0EfG1HiJ2KlM3NoPqR"
```

### ✅ Step 0.3: Backup Database
```bash
pg_dump -U workplus workplus_db > workplus_backup_$(date +%Y%m%d).sql

# Verify
ls -lh workplus_backup_*.sql
```

---

## Phase 1: Backend Database (10 min)

### ✅ Step 1.1: Apply Migration
```bash
cd Backend

# Single command:
psql -U workplus -d workplus_db -f migrations/006_face_embeddings_and_unknowns.sql

# Verify tables created:
psql -U workplus -d workplus_db << EOF
\dt unknown_persons
\dt employee_face_embeddings
\dt unknown_person_links_audit
EOF
```

**Expected output:**
```
public | unknown_persons                | table | workplus
public | employee_face_embeddings       | table | workplus
public | unknown_person_links_audit     | table | workplus
```

### ✅ Step 1.2: Verify Indexes
```bash
psql -U workplus -d workplus_db -c "\di" | grep unknown

# Should show multiple indexes
```

---

## Phase 2: Backend Application (15 min)

### ✅ Step 2.1: Copy Service File
```bash
cp Backend/services/unknown_person_service.py Backend/services/

# Verify it's there
ls -la Backend/services/unknown_person_service.py
```

### ✅ Step 2.2: Copy Router File
```bash
cp Backend/api/routers/unknown_persons.py Backend/api/routers/

# Verify
ls -la Backend/api/routers/unknown_persons.py
```

### ✅ Step 2.3: Register Router in Main App

**File**: `Backend/main.py`

Find the section with router includes:
```python
# Around line 50-100, you'll see:
app.include_router(admins.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
# ... etc
```

Add this line:
```python
from api.routers import unknown_persons
# ... in the imports section at top

# Then add to the app.include_router calls:
app.include_router(unknown_persons.router, prefix="/api")
```

**Verification:**
```bash
cd Backend
python -c "from api.routers import unknown_persons; print('✅ Router imports successfully')"

# Start backend and check
python main.py

# In another terminal:
curl http://localhost:8000/api/unknown-persons/unlinked

# Should return 200 with empty list:
# {"meta": {"total": 0, ...}, "data": []}
```

### ✅ Step 2.4: Backend Restart
```bash
# Stop current backend (Ctrl+C)
# Restart:
cd Backend
python main.py

# In logs, you should see:
# INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## Phase 3: Worker Installation (20 min)

### ✅ Step 3.1: Create Virtual Environment
```bash
python -m venv venv_worker

# Activate
source venv_worker/bin/activate  # Linux/Mac
# or
venv_worker\Scripts\activate  # Windows
```

### ✅ Step 3.2: Install Requirements
```bash
pip install --upgrade pip
pip install -r requirements_worker.txt

# This will take 10-15 minutes (large dependencies)
# Watch for any errors, should complete with "Successfully installed"
```

### ✅ Step 3.3: Download Models
```bash
# YOLOv8 face detector (~100MB)
python -c "from ultralytics import YOLO; YOLO('yolov8n-face.pt')"

# Should see:
# Downloading https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8n-face.pt
# 100%

# FaceNet embeddings (~200MB)
python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l').prepare(ctx_id=0)"

# Should see:
# Model dir: /root/.insightface/models/buffalo_l
# Downloading...
# Model loaded
```

### ✅ Step 3.4: Configure Environment
```bash
# Copy template
cp .env.example.worker .env

# Edit .env
nano .env  # or your favorite editor

# Set these values:
WORKPLUS_API_URL=http://localhost:8000
AI_CAMERA_AGENT_TOKEN=<your-token-from-step-0.2>
WORKER_DEVICE=cuda
WORKER_VRAM_LIMIT_GB=6
WORKER_LOG_LEVEL=INFO
```

### ✅ Step 3.5: Test Worker Startup
```bash
# Dry run (will fail at API auth but shows model loading)
python human_recognition_worker.py

# Watch logs for:
# 🖥️  Device: cuda
# 💾 VRAM limit: 6GB
# 📦 Loading YOLOv8 face detector...
# ✅ Face detector loaded
# 📦 Loading FaceNet512 embedding extractor...
# ✅ FaceNet512 loaded via InsightFace
# 🚀 HumanRecognition Worker starting...
# 📹 Loaded X cameras from API
# ✅ X camera streams active
```

---

## Phase 4: Integration Testing (15 min)

### ✅ Step 4.1: Start Everything in Order

**Terminal 1** - Backend:
```bash
cd Backend
python main.py
# Should see: Uvicorn running on http://0.0.0.0:8000
```

**Terminal 2** - Worker:
```bash
source venv_worker/bin/activate  # or activate from step 3.1
python human_recognition_worker.py
# Should see: ✅ X camera streams active
```

### ✅ Step 4.2: Verify Camera Registration
```bash
# In new terminal:
curl -H "Authorization: Bearer $AI_CAMERA_AGENT_TOKEN" \
  http://localhost:8000/internal/cameras/active | python -m json.tool

# Should return JSON with cameras
```

### ✅ Step 4.3: Check Database Activity
```bash
# In new terminal, watch for new detections (every 5 seconds):
watch -n 5 'psql -U workplus -d workplus_db -c "SELECT COUNT(*) as total_detections, COUNT(DISTINCT employee_id) as known, COUNT(CASE WHEN employee_id IS NULL THEN 1 END) as unknown FROM camera_detection_events;"'

# Should see counts increasing
```

### ✅ Step 4.4: Monitor Unknown Persons
```bash
# API call - list unknown persons
curl http://localhost:8000/api/unknown-persons/unlinked

# Should return detected unknowns (if any faces detected)
```

---

## Phase 5: Admin Testing (10 min)

### ✅ Step 5.1: Admin Panel Access
```
Open browser: http://localhost:3000/admin/unknown-persons
(Assuming React frontend on port 3000)
```

### ✅ Step 5.2: Manual Test - Link Unknown to Employee
```bash
# Get an unknown person
UNKNOWN_ID=$(curl http://localhost:8000/api/unknown-persons/unlinked | \
  python -c "import sys, json; data=json.load(sys.stdin); print(data['data'][0]['id'] if data['data'] else 'none')")

# Get an employee
EMPLOYEE_ID=$(curl http://localhost:8000/api/employees?limit=1 | \
  python -c "import sys, json; data=json.load(sys.stdin); print(data['data'][0]['id'] if data['data'] else 'none')")

# Link them
curl -X POST \
  "http://localhost:8000/api/unknown-persons/$UNKNOWN_ID/link-to-employee/$EMPLOYEE_ID?reason=test" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response should show:
# {"message": "Unknown person linked to employee...", "data": {...}}
```

### ✅ Step 5.3: Verify Retroactive Update
```bash
# Check if old detections were updated
psql -U workplus -d workplus_db << EOF
SELECT employee_id, COUNT(*) 
FROM camera_detection_events 
WHERE employee_id = '$EMPLOYEE_ID'
GROUP BY employee_id;
EOF

# Should show count > 0 (retroactively linked detections)
```

---

## Phase 6: Production Deployment (20 min)

### ✅ Step 6.1: Setup Systemd Service (Linux)
```bash
# Create service file
sudo tee /etc/systemd/system/human-recognition-worker.service > /dev/null <<EOF
[Unit]
Description=HumanRecognition Worker for WorkPlus
After=network.target
Wants=workplus-backend.service

[Service]
Type=simple
User=workplus
WorkingDirectory=/home/workplus/human_recognition_worker
Environment="PYTHONUNBUFFERED=1"
EnvironmentFile=/home/workplus/human_recognition_worker/.env
ExecStart=/home/workplus/human_recognition_worker/venv_worker/bin/python human_recognition_worker.py
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable human-recognition-worker
sudo systemctl start human-recognition-worker

# Check status
sudo systemctl status human-recognition-worker
```

### ✅ Step 6.2: Docker Option (If Preferred)
```bash
# Build image
docker build -f Dockerfile.worker -t workplus/human-recognition-worker:1.0 .

# Test run
docker run --gpus all \
  -e WORKPLUS_API_URL=http://localhost:8000 \
  -e AI_CAMERA_AGENT_TOKEN=$AI_CAMERA_AGENT_TOKEN \
  workplus/human-recognition-worker:1.0

# Run with compose
docker-compose -f docker-compose.worker.yml up -d
```

### ✅ Step 6.3: Setup Log Rotation
```bash
# Create logrotate config
sudo tee /etc/logrotate.d/human-recognition-worker > /dev/null <<EOF
/home/workplus/human_recognition_worker/human_recognition_worker.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 workplus workplus
}
EOF
```

### ✅ Step 6.4: Monitoring Setup (Optional)
```bash
# Install Prometheus exporter (optional)
pip install prometheus-client

# Or setup basic monitoring:
# Create cron job to check worker health
(crontab -l 2>/dev/null; echo "*/5 * * * * ps aux | grep human_recognition_worker > /tmp/worker_health.log") | crontab -
```

---

## Phase 7: Validation Checklist

### ✅ All Systems Go

- [ ] Database migration applied (`unknown_persons` table exists)
- [ ] Backend router registered (GET `/api/unknown-persons/unlinked` returns 200)
- [ ] Worker started successfully (no GPU errors, models loaded)
- [ ] Cameras registered (GET `/internal/cameras/active` returns list)
- [ ] Detections appearing in DB (camera_detection_events count increasing)
- [ ] Unknown persons clustering working (unknown_persons table has entries)
- [ ] Admin panel showing unknown persons (http://localhost:3000/admin/unknown-persons)
- [ ] Manual linking tested (unknown → employee link works)
- [ ] Retroactive update verified (old detections now have employee_id)
- [ ] Logs clean (no errors, just info/debug messages)
- [ ] Performance acceptable (CPU <80%, VRAM 4-6GB)
- [ ] Systemd service running (if deployed on Linux)

---

## Emergency Procedures

### If Worker Crashes
```bash
# Check logs
tail -100 human_recognition_worker.log

# Common causes:
# 1. VRAM out of memory → Increase frame skip
# 2. Network timeout → Check API connectivity
# 3. Camera offline → Camera will auto-recover
# 4. Token invalid → Regenerate and update .env

# Restart
systemctl restart human-recognition-worker  # or Docker
```

### If Database Gets Corrupted
```bash
# Restore from backup
psql -U workplus workplus_db < workplus_backup_<date>.sql

# Or migrate fresh
psql -U workplus -d workplus_db -f migrations/006_face_embeddings_and_unknowns.sql
```

### If API Token Leaks
```bash
# Generate new token
export AI_CAMERA_AGENT_TOKEN=$(python -c "import secrets; print(secrets.token_urlsafe(32))")

# Update all places:
# 1. Backend: .env
# 2. Worker: .env
# 3. Systemd service: edit /etc/systemd/system/human-recognition-worker.service
# 4. Docker: docker-compose.worker.yml
# 5. Kubernetes secrets (if using K8s)

# Restart services
systemctl restart human-recognition-worker
systemctl restart workplus-backend
```

---

## Success Metrics (First Week)

| Metric | Target | Verify |
|--------|--------|--------|
| Worker uptime | >95% | `systemctl status` |
| Detection rate | >90% | `SELECT COUNT(*) FROM camera_detection_events` |
| API latency | <500ms | Logs, performance metrics |
| VRAM usage | 4-6GB | `nvidia-smi` |
| Unknown persons detected | >5 | `/api/unknown-persons/unlinked` |
| Successful linking | >80% | Manual testing + logs |

---

## Next Steps (Post-Launch)

1. **Performance tuning** - Adjust thresholds based on real-world data
2. **Employee embedding pre-computation** - Build embeddings for all existing employees
3. **Monitoring dashboard** - Grafana + Prometheus for visibility
4. **Privacy settings** - Configure what gets logged/stored
5. **User training** - Teach HR staff how to use unknown persons panel
6. **Documentation** - Create internal wiki for troubleshooting

---

**Completion**: After all Phase 7 checkboxes are ticked, system is production-ready! 🎉

