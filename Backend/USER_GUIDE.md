# WORKPLUS Foydalanish Yo'riqnomasi

## 1. Tizim Haqida

WORKPLUS backend HR va yo'qlama jarayonlarini boshqarish uchun ishlatiladi.

Tizim quyidagi asosiy qismlardan iborat:

- Adminlar va foydalanuvchilarni boshqarish.
- Bo'limlar yaratish va boshqarish.
- Lavozimlar yaratish va boshqarish.
- Xodimlar ro'yxatini yuritish.
- Eshiklar va Hikvision qurilmalarini ro'yxatga olish.
- Ish va tushlik vaqtlarini sozlash.
- Hikvision qurilmalaridan avtomatik yo'qlama olish.
- Xodimlarning kirish va chiqish vaqtlarini ko'rish, filterlash va tahrirlash.

## 2. Rollar

### Admin

Admin tizimdagi barcha asosiy funksiyalardan foydalanadi:

- Admin yaratish, tahrirlash va o'chirish.
- Bo'lim CRUD.
- Lavozim CRUD.
- Xodim CRUD.
- Eshik CRUD.
- Attendance policy sozlash.
- Yo'qlama eventlarini ko'rish, tahrirlash va o'chirish.
- Hikvision poller holatini tekshirish.

### HR

HR xodimlar va yo'qlama jarayonlarini boshqaradi:

- Bo'lim CRUD.
- Lavozim CRUD.
- Xodim CRUD.
- Eshik CRUD.
- Attendance policy sozlash.
- Yo'qlama eventlarini ko'rish, tahrirlash va o'chirish.

### User

User roli oddiy xodimlar uchun mo'ljallangan:

- Faqat o'z profilini ko'rish.
- Kelajakda shaxsiy yo'qlama tarixini ko'rish uchun kengaytirilishi mumkin.

## 3. Birinchi Ishga Tushirish

### 3.1. Muhit Sozlamalari

Backend ishlashi uchun `.env` qiymatlari tayyor bo'lishi kerak.

Kerakli sozlamalar:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=workplus
DB_USER=postgres
DB_PASSWORD=change-me
JWT_SECRET_KEY=change-me
JWT_ALGORITHM=HS256
HIKVISION_POLLING_ENABLED=true
HIKVISION_USERNAME=admin
HIKVISION_PASSWORD=change-me
HIKVISION_POLL_INTERVAL_SECONDS=5
HIKVISION_MAX_RESULTS=10
HIKVISION_PICTURES_DIR=face_captures
HIKVISION_RAW_LOG_FILE=raw_events.jsonl
```

### 3.2. Database Tayyorlash

Quyidagi SQL fayllar bazaga qo'llanadi:

- `sql/employees_module.sql`
- `sql/attendance_module.sql`

Bu fayllar quyidagi jadvallarni yaratadi:

- `departments`
- `positions`
- `employees`
- `doors`
- `attendance_policies`
- `attendance_events`

### 3.3. Birinchi Admin Yaratish

Tizimda admin yo'q bo'lsa, birinchi admin token talab qilmasdan yaratiladi.

Endpoint:

```http
POST /admin/create
```

Body:

```json
{
  "full_name": "System Admin",
  "username": "admin",
  "email": "admin@example.com",
  "password": "strong-password"
}
```

Keyingi adminlarni yaratish uchun admin token kerak bo'ladi.

## 4. Login Qilish

Endpoint:

```http
POST /admin/login
```

Body:

```json
{
  "username": "admin",
  "password": "strong-password"
}
```

Response:

```json
{
  "access_token": "jwt-token",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "full_name": "System Admin",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "is_active": true,
    "created_at": "2026-04-29 10:00:00"
  }
}
```

Keyingi so'rovlarda token quyidagicha yuboriladi:

```http
Authorization: Bearer jwt-token
```

## 5. Dastlabki Sozlash Tartibi

Tizimdan to'g'ri foydalanish uchun sozlash tartibi quyidagicha:

1. Admin login qiladi.
2. Bo'limlar yaratiladi.
3. Lavozimlar yaratiladi.
4. Xodimlar yaratiladi.
5. Eshiklar ro'yxatga olinadi.
6. Ish va tushlik vaqti policy sozlanadi.
7. Hikvision polling ishga tushganini tekshiriladi.
8. Yo'qlama eventlari monitoring qilinadi.

## 6. Bo'limlar Bilan Ishlash

Bo'lim xodimlarni guruhlash uchun ishlatiladi.

### Bo'lim Yaratish

```http
POST /departments
```

Body:

```json
{
  "name": "IT"
}
```

### Bo'limlarni Ko'rish

```http
GET /departments
```

### Bo'limni Tahrirlash

```http
PATCH /departments/{department_id}
```

Body:

```json
{
  "name": "Engineering"
}
```

### Bo'limni O'chirish

```http
DELETE /departments/{department_id}
```

Agar bo'limga xodim bog'langan bo'lsa, bo'lim o'chirilmaydi.

## 7. Lavozimlar Bilan Ishlash

Lavozim xodimning ishdagi rolini bildiradi.

### Lavozim Yaratish

```http
POST /positions
```

Body:

```json
{
  "name": "Backend Developer"
}
```

### Lavozimlarni Ko'rish

```http
GET /positions
```

### Lavozimni Tahrirlash

```http
PATCH /positions/{position_id}
```

Body:

```json
{
  "name": "Senior Backend Developer"
}
```

### Lavozimni O'chirish

```http
DELETE /positions/{position_id}
```

Agar lavozimga xodim bog'langan bo'lsa, lavozim o'chirilmaydi.

## 8. Xodimlar Bilan Ishlash

Xodim yaratish uchun avval department va position bo'lishi kerak.

### Xodim Yaratish

```http
POST /employees
```

Body:

```json
{
  "full_name": "Ali Valiyev",
  "department_id": "department-uuid",
  "position_id": "position-uuid",
  "is_active": true
}
```

### Xodimlarni Ko'rish

```http
GET /employees?page=1&limit=10
```

Filterlar:

- `department_id`
- `is_active`
- `sort=created_at`
- `sort=name`
- `order=asc`
- `order=desc`

Misol:

```http
GET /employees?page=1&limit=20&department_id=department-uuid&is_active=true&sort=name&order=asc
```

### Xodimni Ko'rish

```http
GET /employees/{employee_id}
```

### Xodimni Tahrirlash

```http
PATCH /employees/{employee_id}
```

Body:

```json
{
  "full_name": "Ali Valiyev",
  "department_id": "department-uuid",
  "position_id": "position-uuid",
  "is_active": true
}
```

### Xodimni O'chirish

```http
DELETE /employees/{employee_id}
```

Bu amal xodimni bazadan o'chirmaydi. Faqat `is_active=false` qiladi.

## 9. Eshiklar Bilan Ishlash

Eshiklar Hikvision qurilmalari bilan bog'lanadi.

Har bir eshikda quyidagi ma'lumotlar bo'ladi:

- `name`: eshik nomi.
- `ip_address`: Hikvision device IP manzili.
- `event_type`: `entry` yoki `exit`.
- `is_active`: pollingga qo'shilgan yoki qo'shilmagan holat.

### Eshik Yaratish

```http
POST /doors
```

Body:

```json
{
  "name": "Main Entrance",
  "ip_address": "192.168.30.165",
  "event_type": "entry",
  "is_active": true
}
```

### Chiqish Eshigi Yaratish

```http
POST /doors
```

Body:

```json
{
  "name": "Main Exit",
  "ip_address": "192.168.30.168",
  "event_type": "exit",
  "is_active": true
}
```

### Eshiklarni Ko'rish

```http
GET /doors?page=1&limit=10
```

Filterlar:

- `name`
- `ip_address`
- `event_type`
- `is_active`
- `sort=name`
- `sort=ip_address`
- `sort=event_type`
- `sort=created_at`
- `order=asc`
- `order=desc`

Misol:

```http
GET /doors?page=1&limit=20&event_type=entry&is_active=true&sort=name&order=asc
```

### Eshikni Tahrirlash

```http
PATCH /doors/{door_id}
```

Body:

```json
{
  "name": "Main Entrance Updated",
  "ip_address": "192.168.30.165",
  "event_type": "entry",
  "is_active": true
}
```

### Eshikni O'chirish

```http
DELETE /doors/{door_id}
```

Eslatma: agar tarix saqlanishi muhim bo'lsa, eshikni o'chirish o'rniga `is_active=false` qilish tavsiya qilinadi.

## 10. Ish Vaqti Va Tushlik Policy

Attendance statuslar policy asosida hisoblanadi.

### Policy Saqlash

```http
PUT /attendance-policy
```

Body:

```json
{
  "work_start_time": "09:00",
  "work_end_time": "18:00",
  "lunch_start_time": "13:00",
  "lunch_end_time": "14:00",
  "late_grace_minutes": 5,
  "early_leave_grace_minutes": 5,
  "is_active": true
}
```

Ma'nosi:

- `work_start_time`: ish boshlanish vaqti.
- `work_end_time`: ish tugash vaqti.
- `lunch_start_time`: tushlik boshlanishi.
- `lunch_end_time`: tushlik tugashi.
- `late_grace_minutes`: necha daqiqa kechikish kechiriladi.
- `early_leave_grace_minutes`: necha daqiqa oldin chiqish kechiriladi.

### Aktiv Policy Ko'rish

```http
GET /attendance-policy
```

## 11. Hikvision Polling Qanday Ishlaydi

Backend ishga tushganda background polling avtomatik start bo'ladi.

Polling jarayoni:

1. Backend bazadan `is_active=true` bo'lgan eshiklarni oladi.
2. Har bir eshik IP manziliga Hikvision ISAPI orqali so'rov yuboradi.
3. Hikvision eventlar ro'yxatini qaytaradi.
4. Backend event ichidan xodim ismi, card ID, vaqt, serial number va rasm URL oladi.
5. Duplicate event tekshiriladi.
6. Rasm mavjud bo'lsa, backend rasmni yuklab oladi.
7. Xodim ismi bo'yicha `employees` jadvalidan xodim topiladi.
8. Eshik `entry` bo'lsa kirish, `exit` bo'lsa chiqish sifatida yoziladi.
9. Policy asosida status hisoblanadi.
10. Event `attendance_events` jadvaliga yoziladi.

Polling holatini ko'rish:

```http
GET /attendance-poller/status
```

Response:

```json
{
  "running": true,
  "poll_interval_seconds": 5,
  "active_doors": 4
}
```

## 12. Yo'qlama Eventlari

Yo'qlama eventlari avtomatik polling orqali yoki manual API orqali yaratiladi.

### Manual Event Yaratish

```http
POST /attendance-events
```

Body:

```json
{
  "door_id": "door-uuid",
  "employee_name": "Ali Valiyev",
  "event_timestamp": "2026-04-29T09:02:00",
  "card_id": "12345",
  "serial_no": "998877",
  "picture_path": "face_captures/image.jpg"
}
```

### Eventlarni Ko'rish

```http
GET /attendance-events?page=1&limit=50
```

Filterlar:

- `employee_id`
- `employee_name`
- `door_id`
- `event_type`
- `status`
- `date_from`
- `date_to`
- `sort=event_timestamp`
- `sort=created_at`
- `sort=employee_name`
- `sort=status`
- `order=asc`
- `order=desc`

Misol:

```http
GET /attendance-events?page=1&limit=50&date_from=01.04.2026&date_to=30.04.2026&employee_name=Ali&sort=event_timestamp&order=desc
```

Bu so'rov 2026-yil aprel oyidagi Ali ismli xodim eventlarini qaytaradi.

### Bitta Eventni Ko'rish

```http
GET /attendance-events/{event_id}
```

### Eventni Tahrirlash

```http
PATCH /attendance-events/{event_id}
```

Body:

```json
{
  "employee_name": "Ali Valiyev",
  "event_timestamp": "2026-04-29T09:02:00",
  "status": "late"
}
```

### Eventni O'chirish

```http
DELETE /attendance-events/{event_id}
```

## 13. Attendance Statuslar

### Kirish Statuslari

`on_time`

Xodim ish vaqtida yoki grace limit ichida kirgan.

`late`

Xodim ish boshlanish va grace limitdan keyin kirgan.

`entry`

Kun ichidagi oddiy kirish event.

`lunch_return`

Xodim tushlikdan qaytgan.

### Chiqish Statuslari

`lunch_out`

Xodim tushlikka chiqqan.

`on_time_exit`

Xodim ish tugash vaqtida yoki undan keyin chiqqan.

`early_exit`

Xodim ish tugash vaqtidan oldin chiqqan.

`exit`

Kun ichidagi oddiy chiqish event.

### Matching Statuslari

`matched`

Eventdagi ism bo'yicha bitta xodim topilgan.

`unmatched`

Eventdagi ism bo'yicha xodim topilmagan.

`ambiguous`

Eventdagi ism bo'yicha bir nechta xodim topilgan.

## 14. Xatolik Holatlari

### Hikvision Login Xato

Sabablar:

- `HIKVISION_USERNAME` noto'g'ri.
- `HIKVISION_PASSWORD` noto'g'ri.
- Qurilma Digest Auth qabul qilmayapti.

Tekshirish:

- `.env` qiymatlarini tekshirish.
- Hikvision admin paneliga shu login bilan kirib ko'rish.

### Device Offline

Sabablar:

- IP noto'g'ri.
- Qurilma tarmoqda emas.
- Firewall yoki VLAN bloklagan.

Tekshirish:

- `doors.ip_address` to'g'riligini tekshirish.
- Serverdan device IPga ping yoki curl qilib ko'rish.

### Event Employee Bilan Bog'lanmadi

Sabablar:

- Hikvision eventdagi `name` employees jadvalidagi `full_name` bilan mos emas.
- Xodim `is_active=false`.
- Bir xil ismli bir nechta xodim bor.

Yechim:

- Employee `full_name` qiymatini Hikvisiondagi ism bilan moslash.
- Xodim aktivligini tekshirish.
- Kelajakda `card_id` mapping qo'shish.

## 15. Kundalik Foydalanish Ssenariysi

HR yoki admin odatda quyidagicha ishlaydi:

1. Login qiladi.
2. Yangi xodim bo'lsa, avval department va position borligini tekshiradi.
3. Xodimni yaratadi yoki tahrirlaydi.
4. Yangi Hikvision eshigi bo'lsa, `doors` orqali qo'shadi.
5. Ish va tushlik vaqtlarini `attendance-policy` orqali sozlaydi.
6. Poller holatini `attendance-poller/status` orqali tekshiradi.
7. Kunlik yoki oylik yo'qlamani `attendance-events` orqali filterlab ko'radi.
8. Noto'g'ri event bo'lsa, eventni tahrirlaydi yoki o'chiradi.

## 16. Muhim Eslatmalar

- Eshik `event_type` noto'g'ri berilsa, kirish chiqish sifatida yoki chiqish kirish sifatida yoziladi.
- Hikvision polling faqat `is_active=true` eshiklarni kuzatadi.
- Duplicate eventlar bazaga qayta yozilmaydi.
- Rasm yuklanmasa ham attendance event saqlanishi mumkin.
- Attendance policy bo'lmasa, event saqlanadi, lekin statuslar soddaroq belgilanadi.
- Productionda employee matching uchun `card_id` mapping qo'shish tavsiya qilinadi.

## 17. Tezkor Checklist

Tizim ishga tayyor bo'lishi uchun:

- `.env` sozlangan.
- Database scriptlar ishlatilgan.
- Admin yaratilgan.
- Departmentlar yaratilgan.
- Positionlar yaratilgan.
- Employeelar yaratilgan.
- Doors yaratilgan.
- Attendance policy saqlangan.
- Hikvision username/password to'g'ri.
- `GET /attendance-poller/status` `running=true` qaytaryapti.
- `GET /attendance-events` eventlarni qaytaryapti.
