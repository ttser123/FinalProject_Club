## FinalProject Club — ระบบจัดการชมรมและกิจกรรม

แอปพลิเคชันเว็บด้วย Node.js + Express + EJS สำหรับจัดการชมรม (Posts/Clubs), สมาชิกชมรม, การจองสถานที่ (Bookings) และกิจกรรม (Events) พร้อมระบบสิทธิ์การใช้งานและการแจ้งเตือน

### สารบัญ
- การติดตั้งและรัน
- ตัวแปรสภาพแวดล้อม (.env)
- โครงสร้างโปรเจกต์
- ส่วนประกอบหลักของระบบ
- เส้นทางหลัก (Routes & Views)
- ฐานข้อมูล
- หมายเหตุด้านความปลอดภัย/การใช้งานจริง

---

### การติดตั้งและรัน
1) ติดตั้ง dependency
```bash
npm install
```
2) สร้างไฟล์ .env (ดูตัวอย่างด้านล่าง) และสร้างฐานข้อมูลตามสคีมาใน `club_db.sql`
3) รันเซิร์ฟเวอร์ในโหมดพัฒนา
```bash
npm run dev
```
เซิร์ฟเวอร์จะเริ่มที่พอร์ต `3000` (หรือค่าจาก `PORT`)

### ตัวแปรสภาพแวดล้อม (.env)
จำเป็นต้องตั้งค่าเพื่อเชื่อมต่อฐานข้อมูลและ session
```bash
PORT=3000
SESSION_SECRET=your-session-secret

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=club_db
```

### โครงสร้างโปรเจกต์ (ย่อ)
```
app.js                     // จุดเริ่มของเซิร์ฟเวอร์ Express
db.js                      // MySQL connection pool (mysql2/promise)
club_db.sql                // สคีมาฐานข้อมูล
middleware/
  auth.js                  // ตัวช่วยตรวจสิทธิ์และบทบาท
  notifications.js         // คำนวณตัวนับแจ้งเตือนและสถานะสมาชิกชมรม
routes/
  auth.js                  // Login/Register/Logout (ไม่แสดงในสรุปนี้)
  posts.js                 // จัดการชมรม/หน้าเพจชมรม (ไม่แสดงในสรุปนี้)
  settings.js              // การตั้งค่าผู้ใช้ (ไม่แสดงในสรุปนี้)
  notifications.js         // การแจ้งเตือน (ไม่แสดงในสรุปนี้)
  booking.js               // การจองสถานที่
  dashboard.js             // หน้าควบคุมตามบทบาท (ไม่แสดงในสรุปนี้)
  events.js                // จัดการกิจกรรม
views/                     // เทมเพลต EJS
public/                    // ไฟล์ static (css/js/images/uploads)
```

### ส่วนประกอบหลักของระบบ
- Session/Views/Static:
  - ใช้ `express-session` จัดการเซสชัน, `EJS` เป็น view engine, เสิร์ฟไฟล์ใน `public/` และ `public/uploads/`
  - กำหนด `app.locals.upload` (multer) สำหรับอัปโหลดรูปภาพ (จำกัด 5MB เฉพาะไฟล์รูป)
- Middleware:
  - `middleware/notifications.js` เติม `res.locals.unreadCount` และ `res.locals.isClubMember`
  - `middleware/auth.js` มี helper ตรวจการล็อกอินและเช็คบทบาท: `isAuthenticated`, `isAdmin`, `isLeader`, ฯลฯ
- Database:
  - ใช้ `mysql2/promise` ผ่าน `db.js` (pool) ค่าเชื่อมต่อมาจาก `.env`
- การกำหนดเส้นทางหลักใน `app.js`:
  - `/auth`, `/settings`, `/posts`, `/notifications`, `/booking`, `/dashboard`, `/events`
  - หน้าแรก `/` เรนเดอร์ `views/auth/login.ejs`
  - `/index` และ `/index/search` แสดง/ค้นหาโพสต์โดยเงื่อนไขบทบาทผู้ใช้

### เส้นทางหลัก (Routes & Views)

#### Booking (`routes/booking.js`)
- GET `/booking` (leader เท่านั้น): แสดงตารางการจอง รวมชื่อผู้จอง/สถานที่/วันเวลา → `views/booking.ejs`
- GET `/booking/new`: ฟอร์มสร้างการจอง → `views/booking-new.ejs`
- GET `/booking/check`: ตรวจเวลาทับซ้อน (JSON) พารามิเตอร์ `place_id`, `date`, `time_start`, `time_end`
- POST `/booking`: บันทึกการจอง พร้อม validation เวลาและตรวจซ้ำ

หมายเหตุใน `views/booking.ejs`:
- ปุ่มสร้างกิจกรรมลิงก์ไปที่ `/events/new?postId=<id>` ถ้ามี `post.id`; ถ้าไม่มีก็ไป `/events/new` ได้เลย

#### Events (`routes/events.js`)
- ตาราง/สคีมา: สร้างตาราง `events`, `event_participants` แบบ idempotent เมื่อมีการเรียกใช้งาน
- Require Login ทุกเส้นทางภายใต้ `/events`
- GET `/events/new`: ตรวจจับชมรมที่ผู้ใช้เป็นหัวหน้าโดยอัตโนมัติ (ถือว่าเป็นหัวหน้าได้เพียงชมรมเดียว) แล้วเรนเดอร์ฟอร์มสร้างกิจกรรมทันที → `views/events/new.ejs`
  - โหลดรายการ booking ของผู้นำชมรม (จาก `student_id`) ที่ยังไม่ผ่านและยังไม่ถูกใช้สร้าง event
- POST `/events`: สร้างกิจกรรม โดยอ้างอิงเวลา/วันที่จาก booking ที่เลือก และตรวจสิทธิ์เป็น leader/admin ของชมรมนั้น
- GET `/events/:id`: รายละเอียดกิจกรรม + รายชื่อผู้เข้าร่วม + ปุ่มเข้าร่วม/จัดการตามสิทธิ์ → `views/events/show.ejs`
- POST `/events/:id/join`: สมาชิกเข้าร่วมกิจกรรม (ป้องกันหัวหน้า/แอดมินเข้าร่วมเอง, เช็คความจุ/สถานะเปิดรับ)
- POST `/events/:id/toggle`: สลับเปิด/ปิดการรับสมัคร (leader/admin)
- POST `/events/:id/attendance`: บันทึกสถานะเข้าร่วมและคะแนน (leader/admin)
- POST `/events/:id/cancel`: ยกเลิกกิจกรรม (leader/admin)
- POST `/events/:id/end`: สิ้นสุดกิจกรรม (leader/admin)
- GET `/events`: รายการกิจกรรมทั้งหมด (กรองตามสิทธิ์)

#### Pages/Index (`app.js`)
### แดชบอร์ด (Dashboards)

- Admin (`/dashboard` เมื่อ role = admin) — แสดงภาพรวมระบบและเครื่องมือบริหาร:
  - ตัวเลขสรุป: จำนวนชมรม, หัวหน้าชมรม, สมาชิก, การจอง, กิจกรรม, ห้องใช้งาน/ห้องว่าง
  - กราฟ: สมาชิกต่อชมรม (Top 10), กิจกรรมต่อชมรม (Top 10), อัตราการใช้ห้องรายเดือน (ประมาณการ)
  - การแจ้งเตือนล่าสุด 5 รายการ

- Leader (`/dashboard` เมื่อ role = leader) — โฟกัสชมรมที่ดูแล:
  - ตัวเลขสรุป: จำนวนชมรมที่ดูแล, สมาชิกที่อนุมัติ, สมัครรออนุมัติ, จำนวนการจองที่สร้าง
  - อัตราการเข้าร่วมโดยประมาณ (Approved / (Approved + Pending))
  - จำนวนกิจกรรม (กำลังจะจัด / ที่จัดแล้ว) และรายการกิจกรรมใกล้ถึง (5 รายการ)

- Member (`/dashboard` เมื่อ role = member) — มุมมองส่วนตัว:
  - ตัวเลขสรุป: จำนวนชมรมที่เป็นสมาชิก, จำนวนกิจกรรมที่เข้าร่วม, คะแนนสะสม
  - ข่าวสารล่าสุดจากชมรมที่เป็นสมาชิก (5 รายการ)
  - กราฟเส้น: สถิติการเข้าร่วมกิจกรรมย้อนหลัง (เทียบกับค่าเฉลี่ยสมาชิก)

- GET `/index`: ถ้าเป็นสมาชิกชมรมอยู่แล้วจะ redirect ไปหน้า `posts/:post_id`; ถ้าเป็น admin เห็นทุกชมรม
- GET `/index/search`: ค้นหาชมรมด้วย title โดยเงื่อนไขบทบาท

### Views (EJS)
- `views/auth/` หน้า `login.ejs`, `register.ejs`
- `views/pages/index.ejs` หน้า index/ค้นหา
- `views/booking.ejs` ตารางการจอง, `views/booking-new.ejs` ฟอร์มจอง
- `views/events/` มี `index.ejs`, `new.ejs`, `show.ejs`
- `views/posts/` จัดการเพจชมรม/ข่าว/ไฟล์อัปโหลด (หลายไฟล์)
- ส่วนหัวร่วม `views/partials/header.ejs`

### สไตล์และ Static Assets
- CSS ที่ `public/css/` (เช่น `main.css`, `partials/header.css`, และโฟลเดอร์ย่อย)
- JavaScript ฝั่ง client ใน `public/js/` (เช่น `events.js`)
- รูปภาพใน `public/images/`, ไฟล์อัปโหลดใน `public/uploads/`

### ฐานข้อมูล
- ดูสคีมาฐานข้อมูลทั้งหมดใน `club_db.sql` (มีตารางผู้ใช้ ชมรม หมวดหมู่ สมาชิกชมรม การจอง สถานที่ การแจ้งเตือน ฯลฯ)
- สคริปต์ใน `routes/events.js` มีการ ensure ตารางกิจกรรมและผู้เข้าร่วมให้พร้อมใช้งาน

### หมายเหตุด้านความปลอดภัย/การใช้งานจริง
- ตั้งค่า `SESSION_SECRET` ให้ปลอดภัยใน production และเปิด `cookie` options (secure/sameSite) ตามสภาพแวดล้อมจริง
- เพิ่ม rate limit (`express-rate-limit`) และ validation (`express-validator`) ให้เข้มงวดยิ่งขึ้นตามจุดรับข้อมูลจากผู้ใช้
- ตรวจสอบสิทธิ์แบบละเอียดในทุกจุดที่แก้ไขข้อมูลสำคัญ
- กำหนดสิทธิ์ระบบไฟล์ `public/uploads/` และ sanitize ชื่อไฟล์หากจำเป็น

---

หากต้องการรายละเอียด endpoint ที่ไม่อยู่ในสรุปนี้ ให้เปิดดูที่ไฟล์ใน `routes/` ที่เกี่ยวข้องโดยตรง (เช่น `routes/posts.js`, `routes/auth.js`).


