# Superadmin Backup & User Management System

**Xususiyat**: Superadmin uchun backup download/upload, MERGE/HARD_SET, va user management

---

## 📋 Overview

```
Superadmin Panel
├── Backup Management
│   ├── Export backup (FULL, EMPLOYEES, ATTENDANCE)
│   ├── Download backup files
│   ├── Upload/Import backups
│   │   ├── MERGE mode: server + backup data combine
│   │   └── HARD_SET mode: faqat backup data (qadimiy data o'chish)
│   └── View restore history & audit log
│
└── User Management
    ├── Create new users (superadmin, admin, hr)
    ├── List all users
    ├── Edit user details
    ├── Change user roles
    ├── Toggle active/inactive
    └── Delete users
```

---

## 🗂️ Created Files

| File | Purpose |
|------|---------|
| `Backend/migrations/007_backup_management.sql` | DB tables: backup_metadata, backup_restore_log |
| `Backend/services/backup_service.py` | Export/import logic, merge/hard-set |
| `Backend/api/routers/backup.py` | Backup API endpoints (download, upload, list) |
| `Backend/api/routers/superadmin_users.py` | User management endpoints |
| `SUPERADMIN_BACKUP_GUIDE.md` | This guide |

---

## 🚀 Implementation

### Step 1: Database Migration

```bash
psql -U workplus -d workplus_db -f Backend/migrations/007_backup_management.sql

# Verify
psql -U workplus -d workplus_db -c "\dt backup_metadata"
```

### Step 2: Register Routers in Backend

**File**: `Backend/main.py`

```python
from api.routers import backup, superadmin_users

# Add these lines:
app.include_router(backup.router, prefix="/api")
app.include_router(superadmin_users.router, prefix="/api")
```

### Step 3: Restart Backend

```bash
cd Backend
python main.py
```

---

## 📤 Backup Export

### API Call

```bash
# Full backup
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8000/api/superadmin/backups/export?backup_type=FULL"

# Only employees
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8000/api/superadmin/backups/export?backup_type=EMPLOYEES"

# Only attendance
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:8000/api/superadmin/backups/export?backup_type=ATTENDANCE"
```

### Response

```json
{
  "message": "✅ Backup exported successfully",
  "backup_id": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "backup_name": "backup_20260602_143022",
    "backup_type": "FULL",
    "file_size": 2048576,
    "file_hash": "abc123def456...",
    "created_at": "2026-06-02T14:30:22.123456",
    "records_count": 5234,
    "employees_count": 150,
    "attendance_events": 5084
  }
}
```

---

## 📥 Backup Import

### Two Modes

#### Mode 1: MERGE (Combine Data)

```bash
# Server data + Backup data qo'shiladi
curl -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "file=@backup_20260602_143022.json.gz" \
  "http://localhost:8000/api/superadmin/backups/import?restore_type=MERGE"
```

**Result**: Old data + new data = combined

---

#### Mode 2: HARD_SET (Replace All)

```bash
# Faqat backup data qoladi, qadimiy data o'chib ketadi
# ⚠️  CONFIRM HEADER REQUIRED!

curl -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "X-Confirm-Hard-Set: YES_DELETE_ALL_DATA" \
  -F "file=@backup_20260602_143022.json.gz" \
  "http://localhost:8000/api/superadmin/backups/import?restore_type=HARD_SET"
```

**Result**: ALL old data deleted, only backup data remains

---

## 👥 User Management

### Create New User

```bash
curl -X POST http://localhost:8000/api/superadmin/users/create \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@company.com",
    "password": "SecurePass123!",
    "full_name": "John Doe",
    "role": "admin"
  }'
```

**Roles**: `superadmin`, `admin`, `hr`

---

### List All Users

```bash
curl http://localhost:8000/api/superadmin/users \
  -H "Authorization: Bearer $JWT_TOKEN"

# Filter by role
curl "http://localhost:8000/api/superadmin/users?role_filter=admin" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Change User Role

```bash
curl -X POST \
  "http://localhost:8000/api/superadmin/users/{user_id}/change-role?new_role=hr" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Deactivate User

```bash
curl -X POST \
  "http://localhost:8000/api/superadmin/users/{user_id}/toggle-active" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Delete User

```bash
curl -X DELETE \
  "http://localhost:8000/api/superadmin/users/{user_id}" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

## 🎨 Frontend Implementation

### Superadmin Backup Dashboard (React/Vue)

```typescript
// Components/SuperadminBackup.tsx

const SuperadminBackupDashboard = () => {
  const [backups, setBackups] = useState([])
  const [restoring, setRestoring] = useState(false)

  // 1. List backups
  const loadBackups = async () => {
    const resp = await fetch('/api/superadmin/backups', {
      headers: { Authorization: `Bearer ${token}` }
    })
    setBackups(await resp.json())
  }

  // 2. Export backup
  const onExport = async (type) => {
    const resp = await fetch(
      `/api/superadmin/backups/export?backup_type=${type}`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
    )
    const result = await resp.json()
    console.log('Backup created:', result.backup_id)
    loadBackups()
  }

  // 3. Download backup
  const onDownload = async (backupId) => {
    const resp = await fetch(
      `/api/superadmin/backups/download?backup_id=${backupId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const { download_url } = await resp.json()
    window.location.href = download_url  // Browser download
  }

  // 4. Upload & restore
  const onUpload = async (file, restoreType) => {
    setRestoring(true)
    const formData = new FormData()
    formData.append('file', file)

    const headers = { Authorization: `Bearer ${token}` }
    if (restoreType === 'HARD_SET') {
      headers['X-Confirm-Hard-Set'] = 'YES_DELETE_ALL_DATA'
    }

    const resp = await fetch(
      `/api/superadmin/backups/import?restore_type=${restoreType}`,
      { method: 'POST', body: formData, headers }
    )

    if (resp.ok) {
      const result = await resp.json()
      alert(`Restored: ${result.stats.rows_created} records`)
      loadBackups()
    } else {
      alert('Restore failed')
    }
    setRestoring(false)
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Superadmin: Backup Management</h1>

      {/* Export Section */}
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h2>📤 Export Backup</h2>
        <button onClick={() => onExport('FULL')}>Full Backup</button>
        <button onClick={() => onExport('EMPLOYEES')}>Employees Only</button>
        <button onClick={() => onExport('ATTENDANCE')}>Attendance Only</button>
      </div>

      {/* Backups List */}
      <div style={{ marginBottom: '20px' }}>
        <h2>📋 Backup Files</h2>
        <button onClick={loadBackups}>Refresh</button>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {backups.data?.map(b => (
              <tr key={b.id}>
                <td>{b.backup_name}</td>
                <td>{b.backup_type}</td>
                <td>{(b.file_size / 1024 / 1024).toFixed(2)} MB</td>
                <td>{new Date(b.created_at).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => onDownload(b.id)}>Download</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Import Section */}
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid red' }}>
        <h2>📥 Import Backup</h2>
        <input type="file" id="backup_file" accept=".gz" />

        <div style={{ marginTop: '10px' }}>
          <h3>Choose Restore Mode:</h3>

          <button
            onClick={() => {
              const file = document.getElementById('backup_file').files[0]
              onUpload(file, 'MERGE')
            }}
            disabled={restoring}
          >
            ✅ MERGE (Combine data)
          </button>

          <button
            onClick={() => {
              if (!window.confirm('⚠️  DELETE ALL SERVER DATA? This cannot be undone!')) return
              const file = document.getElementById('backup_file').files[0]
              onUpload(file, 'HARD_SET')
            }}
            style={{ backgroundColor: 'red', color: 'white' }}
            disabled={restoring}
          >
            🗑️  HARD_SET (Delete all, restore from backup)
          </button>
        </div>

        {restoring && <p>⏳ Restoring... please wait</p>}
      </div>
    </div>
  )
}
```

---

### Superadmin User Management (React/Vue)

```typescript
// Components/SuperadminUsers.tsx

const SuperadminUsers = () => {
  const [users, setUsers] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({})

  const loadUsers = async () => {
    const resp = await fetch('/api/superadmin/users', {
      headers: { Authorization: `Bearer ${token}` }
    })
    setUsers(await resp.json())
  }

  const onCreateUser = async () => {
    const resp = await fetch('/api/superadmin/users/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })
    if (resp.ok) {
      alert('User created!')
      loadUsers()
      setShowCreateForm(false)
    }
  }

  const onChangeRole = async (userId, newRole) => {
    const resp = await fetch(
      `/api/superadmin/users/${userId}/change-role?new_role=${newRole}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    if (resp.ok) {
      loadUsers()
    }
  }

  const onDeleteUser = async (userId) => {
    if (!window.confirm('Delete user?')) return
    const resp = await fetch(
      `/api/superadmin/users/${userId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    if (resp.ok) {
      loadUsers()
    }
  }

  return (
    <div>
      <h1>User Management</h1>

      <button onClick={() => setShowCreateForm(!showCreateForm)}>
        ➕ Create New User
      </button>

      {showCreateForm && (
        <div style={{ padding: '10px', border: '1px solid #ccc', marginBottom: '20px' }}>
          <input
            placeholder="Username"
            onChange={e => setFormData({ ...formData, username: e.target.value })}
          />
          <input
            placeholder="Email"
            type="email"
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
          <input
            placeholder="Password"
            type="password"
            onChange={e => setFormData({ ...formData, password: e.target.value })}
          />
          <input
            placeholder="Full Name"
            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
          />
          <select onChange={e => setFormData({ ...formData, role: e.target.value })}>
            <option>Select Role</option>
            <option value="superadmin">Superadmin</option>
            <option value="admin">Admin</option>
            <option value="hr">HR</option>
          </select>
          <button onClick={onCreateUser}>Create</button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Full Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.data?.map(u => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>{u.full_name}</td>
              <td>
                <select
                  value={u.role}
                  onChange={e => onChangeRole(u.id, e.target.value)}
                >
                  <option value="admin">Admin</option>
                  <option value="hr">HR</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </td>
              <td>{u.is_active ? '✅ Active' : '❌ Inactive'}</td>
              <td>
                <button onClick={() => onDeleteUser(u.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## 🔐 Security Notes

✅ **Only Superadmin**: Backup/restore va user management faqat superadmin role'i uchun
✅ **HARD_SET Warning**: Kayfiyatli confirmation headerini talab qiladi
✅ **Audit Trail**: Barcha restore operations logged (`backup_restore_log` jadvalida)
✅ **File Validation**: Gzip compressed, SHA256 hash verification
⚠️ **Encryption**: Face embeddings + RTSP credentials encrypted qilishni tavsiya

---

## 🚨 Emergency Recovery

### Server Data Lost?

```bash
# 1. Download backup from old backup
curl http://localhost:8000/api/superadmin/backups/download?backup_id=<id>

# 2. Upload with HARD_SET
curl -X POST \
  -H "X-Confirm-Hard-Set: YES_DELETE_ALL_DATA" \
  -F "file=@backup.json.gz" \
  http://localhost:8000/api/superadmin/backups/import?restore_type=HARD_SET
```

---

## 📊 Database Schema

```
backup_metadata
├── id (UUID, PK)
├── superadmin_id (FK → admins)
├── backup_name (VARCHAR)
├── backup_type (FULL|EMPLOYEES|ATTENDANCE|IMPORTED)
├── file_path (TEXT)
├── file_size (BIGINT)
├── file_hash (SHA256)
├── total_records, employees_count, attendance_events
└── created_at, restored_at, restore_type

backup_restore_log
├── id (UUID, PK)
├── backup_id (FK)
├── restored_by_user_id (FK → admins)
├── restore_type (MERGE|HARD_SET)
├── rows_merged, rows_deleted, rows_created
├── status (STARTED|SUCCESS|FAILED)
└── error_message, timestamps
```

---

## ✅ Verification Checklist

- [ ] Migration applied (`backup_metadata` table exists)
- [ ] Routers registered in `Backend/main.py`
- [ ] API endpoints working (`/api/superadmin/backups`)
- [ ] Export test: Full backup download successful
- [ ] Import test: MERGE mode combines data
- [ ] HARD_SET test: Confirmation header required
- [ ] User management: Create/list/delete users works
- [ ] Audit trail: Restore logs recorded
- [ ] Permission check: Non-superadmins get 403

---

**Tabriklashni! Superadmin backup system ready.** 🎉

