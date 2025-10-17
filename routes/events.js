const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');

async function ensureTables() {
  await db.query(`CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    booking_id INT NOT NULL,
    date DATE NOT NULL,
    time_start VARCHAR(5) NOT NULL,
    time_end VARCHAR(5) NOT NULL,
    capacity INT DEFAULT NULL,
    is_open TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_canceled TINYINT(1) NOT NULL DEFAULT 0,
    is_ended TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(book_id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await db.query(`CREATE TABLE IF NOT EXISTS event_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('joined','attended','absent') NOT NULL DEFAULT 'joined',
    points INT NOT NULL DEFAULT 0,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_event_user (event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  // Ensure new columns exist (idempotent for MariaDB 10.4+)
  await db.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INT DEFAULT NULL`);
  await db.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS is_open TINYINT(1) NOT NULL DEFAULT 1`);
  await db.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS is_canceled TINYINT(1) NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS is_ended TINYINT(1) NOT NULL DEFAULT 0`);
}

// Middleware: require login
router.use(async (req, res, next) => {
  await ensureTables().catch(() => {});
  if (!req.session.user) return res.redirect('/auth/login');
  next();
});

// Leader/Admin: show create form — auto-detect single club (leader) if not provided
router.get('/new', async (req, res) => {
  try {
    let { postId } = req.query;

    if (!postId) {
      const [rows] = await db.query(
        `SELECT cm.post_id AS id
         FROM club_members cm
         WHERE cm.user_id = ? AND cm.role = 'leader' AND cm.status = 'approved'`,
        [req.session.user.id]
      );
      if (rows.length === 0) {
        return res.status(403).send('ไม่พบชมรมที่คุณเป็นหัวหน้า');
      }
      // สมมติว่าเป็นหัวหน้าได้เพียงชมรมเดียว
      postId = rows[0].id;
    }

    // Check membership role
    const [membership] = await db.query(
      `SELECT cm.role FROM club_members cm WHERE cm.post_id = ? AND cm.user_id = ? AND cm.status = 'approved'`,
      [postId, req.session.user.id]
    );
    if (membership.length === 0 || !['leader','admin'].includes(req.session.user.role)) {
      return res.status(403).send('ต้องเป็นหัวหน้าชมรมหรือผู้ดูแล');
    }

    // Load leader bookings (by student_id)
    const [bookings] = await db.query(
      `SELECT b.book_id, b.book_name, b.date, b.time, pl.place_name
       FROM bookings b JOIN places pl ON pl.place_id = b.place_id
       WHERE b.student_id = ?
         AND (
           b.date > CURDATE()
           OR (b.date = CURDATE() AND SUBSTRING_INDEX(b.time, '-', -1) >= DATE_FORMAT(NOW(), '%H:%i'))
         )
         AND b.book_id NOT IN (SELECT booking_id FROM events)
       ORDER BY b.date ASC, b.time ASC`,
      [req.session.user.student_id]
    );

    res.render('events/new', { postId, leaderClubs: null, bookings, error: null });
  } catch (err) {
    console.error('GET /events/new error:', err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
});

// Create event
router.post('/', async (req, res) => {
  try {
    const { post_id, title, description, booking_id, capacity, is_open } = req.body;
    if (!post_id || !title || !booking_id) return res.status(400).send('ข้อมูลไม่ครบ');

    // Check permission
    const [membership] = await db.query(
      `SELECT cm.role FROM club_members cm WHERE cm.post_id = ? AND cm.user_id = ? AND cm.status = 'approved'`,
      [post_id, req.session.user.id]
    );
    if (membership.length === 0 || !['leader','admin'].includes(req.session.user.role)) {
      return res.status(403).send('ต้องเป็นหัวหน้าชมรมหรือผู้ดูแล');
    }

    // Fetch booking and parse time
    const [rows] = await db.query(
      `SELECT b.*, pl.place_name FROM bookings b JOIN places pl ON pl.place_id = b.place_id WHERE b.book_id = ?`,
      [booking_id]
    );
    if (rows.length === 0) return res.status(400).send('ไม่พบบุ๊กกิ้ง');
    const booking = rows[0];
    const [timeStart, timeEnd] = String(booking.time).split('-');

    const cap = capacity ? Number(capacity) : null;
    const openFlag = typeof is_open === 'undefined' ? 1 : (is_open ? 1 : 0);
    const [result] = await db.query(
      `INSERT INTO events (post_id, title, description, booking_id, date, time_start, time_end, capacity, is_open)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [post_id, title, description || '', booking_id, booking.date, timeStart, timeEnd, cap, openFlag]
    );

    res.redirect(`/events/${result.insertId}`);
  } catch (err) {
    console.error('POST /events error:', err);
    res.status(500).send('สร้างกิจกรรมล้มเหลว');
  }
});

// View event detail, allow join (members) and attendance (leader)
router.get('/:id', async (req, res) => {
  try {
    const eventId = req.params.id;
    const [rows] = await db.query(
      `SELECT e.*, p.title AS club_title, b.time, pl.place_name
       FROM events e
       JOIN posts p ON p.id = e.post_id
       JOIN bookings b ON b.book_id = e.booking_id
       JOIN places pl ON pl.place_id = b.place_id
       WHERE e.id = ?`,
      [eventId]
    );
    if (rows.length === 0) return res.status(404).send('ไม่พบกิจกรรม');
    const event = rows[0];

    // Participants
    const [participants] = await db.query(
      `SELECT ep.*, u.f_name, u.l_name, u.student_id
       FROM event_participants ep JOIN users u ON u.id = ep.user_id
       WHERE ep.event_id = ? ORDER BY ep.joined_at DESC`,
      [eventId]
    );

    // Is club member?
    const [clubMember] = await db.query(
      `SELECT 1 FROM club_members WHERE post_id = ? AND user_id = ? AND status = 'approved'`,
      [event.post_id, req.session.user.id]
    );

    const canManage = req.session.user.role === 'leader' || req.session.user.role === 'admin';
    const [existing] = await db.query(
      'SELECT 1 FROM event_participants WHERE event_id = ? AND user_id = ? LIMIT 1',
      [eventId, req.session.user.id]
    );
    const alreadyJoined = existing.length > 0;
    const isAdminOrLeader = ['leader','admin'].includes(req.session.user.role);
    const canJoin = clubMember.length > 0 && !isAdminOrLeader;

    res.render('events/show', { event, participants, canJoin, canManage, alreadyJoined });
  } catch (err) {
    console.error('GET /events/:id error:', err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
});

// Member join
router.post('/:id/join', isAuthenticated, async (req, res) => {
  try {
    const eventId = req.params.id;
    // Check member of club
    const [[evt]] = await db.query('SELECT post_id FROM events WHERE id = ?', [eventId]);
    if (!evt) return res.status(404).send('ไม่พบกิจกรรม');
    const [clubMember] = await db.query(
      `SELECT 1 FROM club_members WHERE post_id = ? AND user_id = ? AND status = 'approved'`,
      [evt.post_id, req.session.user.id]
    );
    if (clubMember.length === 0) return res.status(403).send('ต้องเป็นสมาชิกชมรม');
    // Check event open and capacity, and not canceled/ended
    const [[eventRow]] = await db.query('SELECT is_open, capacity, is_canceled, is_ended FROM events WHERE id = ?', [eventId]);
    if (!eventRow) return res.status(404).send('ไม่พบกิจกรรม');
    if (eventRow.is_canceled === 1 || eventRow.is_ended === 1) return res.status(400).send('กิจกรรมนี้ไม่เปิดให้เข้าร่วม');
    if (eventRow.is_open !== 1) return res.status(400).send('ปิดรับการสมัครแล้ว');
    if (eventRow.capacity && eventRow.capacity > 0) {
      const [[{ cnt }]] = await db.query(
        "SELECT COUNT(*) cnt FROM event_participants WHERE event_id = ? AND status IN ('joined','attended')",
        [eventId]
      );
      if (cnt >= eventRow.capacity) return res.status(400).send('จำนวนผู้เข้าร่วมเต็มแล้ว');
    }
    // Do not allow admins/leaders to join
    if (['leader','admin'].includes(req.session.user.role)) return res.status(400).send('เฉพาะสมาชิกเท่านั้นที่เข้าร่วมได้');
    await db.query(
      `INSERT INTO event_participants (event_id, user_id, status) VALUES (?, ?, 'joined')
       ON DUPLICATE KEY UPDATE status = VALUES(status)`,
      [eventId, req.session.user.id]
    );
    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error('POST /events/:id/join error:', err);
    res.status(500).send('เข้าร่วมกิจกรรมล้มเหลว');
  }
});

// Leader/Admin toggle registration open/close
router.post('/:id/toggle', async (req, res) => {
  try {
    const eventId = req.params.id;
    const [[evt]] = await db.query('SELECT post_id, is_open, is_canceled, is_ended FROM events WHERE id = ?', [eventId]);
    if (!evt) return res.status(404).send('ไม่พบกิจกรรม');
    if (evt.is_canceled === 1 || evt.is_ended === 1) {
      return res.status(400).send('กิจกรรมถูกยกเลิกหรือสิ้นสุดแล้ว');
    }
    const [membership] = await db.query(
      `SELECT 1 FROM club_members WHERE post_id = ? AND user_id = ? AND status = 'approved'`,
      [evt.post_id, req.session.user.id]
    );
    if (membership.length === 0 || !['leader','admin'].includes(req.session.user.role)) {
      return res.status(403).send('ไม่มีสิทธิ์');
    }
    const nextVal = evt.is_open === 1 ? 0 : 1;
    await db.query('UPDATE events SET is_open = ? WHERE id = ?', [nextVal, eventId]);
    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error('POST /events/:id/toggle error:', err);
    res.status(500).send('ปรับสถานะการรับสมัครล้มเหลว');
  }
});

// Events index - list events available to user
router.get('/', async (req, res) => {
  try {
    const role = req.session.user.role;
    let events;
    if (role === 'admin') {
      [events] = await db.query(
        `SELECT e.*, p.title AS club_title, pl.place_name
         FROM events e
         JOIN posts p ON p.id = e.post_id
         JOIN bookings b ON b.book_id = e.booking_id
         JOIN places pl ON pl.place_id = b.place_id
         ORDER BY e.date DESC, e.time_start DESC`
      );
    } else {
      [events] = await db.query(
        `SELECT e.*, p.title AS club_title, pl.place_name
         FROM events e
         JOIN posts p ON p.id = e.post_id
         JOIN bookings b ON b.book_id = e.booking_id
         JOIN places pl ON pl.place_id = b.place_id
         JOIN club_members cm ON cm.post_id = e.post_id AND cm.user_id = ? AND cm.status = 'approved'
         ORDER BY e.date DESC, e.time_start DESC`,
        [req.session.user.id]
      );
    }
    res.render('events/index', { events });
  } catch (err) {
    console.error('GET /events error:', err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
});

// Leader marks attendance
router.post('/:id/attendance', async (req, res) => {
  try {
    const eventId = req.params.id;
    const { user_id, attended, points } = req.body;
    // Permission: leader/admin of club
    const [[evt]] = await db.query('SELECT post_id FROM events WHERE id = ?', [eventId]);
    if (!evt) return res.status(404).send('ไม่พบกิจกรรม');
    const [membership] = await db.query(
      `SELECT cm.role FROM club_members cm WHERE cm.post_id = ? AND cm.user_id = ? AND cm.status = 'approved'`,
      [evt.post_id, req.session.user.id]
    );
    if (membership.length === 0 || !['leader','admin'].includes(req.session.user.role)) {
      return res.status(403).send('ไม่มีสิทธิ์บันทึกการเข้าร่วม');
    }

    const status = attended === 'true' || attended === true ? 'attended' : 'absent';
    const pts = Number(points || 0) || 0;
    await db.query(
      `INSERT INTO event_participants (event_id, user_id, status, points)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), points = VALUES(points)`,
      [eventId, user_id, status, pts]
    );
    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error('POST /events/:id/attendance error:', err);
    res.status(500).send('บันทึกการเข้าร่วมล้มเหลว');
  }
});

// Cancel event (leader/admin)
router.post('/:id/cancel', async (req, res) => {
  try {
    const eventId = req.params.id;
    const [[evt]] = await db.query('SELECT post_id, is_canceled FROM events WHERE id = ?', [eventId]);
    if (!evt) return res.status(404).send('ไม่พบกิจกรรม');
    const [membership] = await db.query(
      `SELECT 1 FROM club_members WHERE post_id = ? AND user_id = ? AND status = 'approved'`,
      [evt.post_id, req.session.user.id]
    );
    if (membership.length === 0 || !['leader','admin'].includes(req.session.user.role)) {
      return res.status(403).send('ไม่มีสิทธิ์');
    }
    await db.query('UPDATE events SET is_canceled = 1, is_open = 0 WHERE id = ?', [eventId]);
    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error('POST /events/:id/cancel error:', err);
    res.status(500).send('ยกเลิกกิจกรรมล้มเหลว');
  }
});

// End event (leader/admin)
router.post('/:id/end', async (req, res) => {
  try {
    const eventId = req.params.id;
    const [[evt]] = await db.query('SELECT post_id FROM events WHERE id = ?', [eventId]);
    if (!evt) return res.status(404).send('ไม่พบกิจกรรม');
    const [membership] = await db.query(
      `SELECT 1 FROM club_members WHERE post_id = ? AND user_id = ? AND status = 'approved'`,
      [evt.post_id, req.session.user.id]
    );
    if (membership.length === 0 || !['leader','admin'].includes(req.session.user.role)) {
      return res.status(403).send('ไม่มีสิทธิ์');
    }
    await db.query('UPDATE events SET is_ended = 1, is_open = 0 WHERE id = ?', [eventId]);
    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error('POST /events/:id/end error:', err);
    res.status(500).send('สิ้นสุดกิจกรรมล้มเหลว');
  }
});

module.exports = router;


