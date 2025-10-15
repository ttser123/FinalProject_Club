const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware สำหรับตรวจสอบว่าเป็น leader เท่านั้น
const ensureLeader = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    if (req.session.user.role !== 'leader') {
        return res.status(403).send('เฉพาะหัวหน้าชมรมเท่านั้นที่สามารถจองสถานที่ได้');
    }
    next();
};

// แสดงตารางการจอง (แทนหน้าแบบฟอร์มเดิม)
router.get('/', ensureLeader, async (req, res) => {
    try {
        const [bookings] = await db.query(
            `SELECT CONCAT(u.f_name, ' ', u.l_name) AS reserver_name,
                    b.book_name,
                    pl.place_name,
                    b.date,
                    b.time
             FROM bookings b
             JOIN users u ON u.student_id = b.student_id
             JOIN places pl ON pl.place_id = b.place_id
             ORDER BY b.date DESC, b.time DESC`
        );
        res.render('booking', { bookings, success: req.query.success, user: req.session.user });
    } catch (err) {
        console.error('GET /booking error:', err);
        res.status(500).send('Database error');
    }
});

// หน้าใหม่สำหรับฟอร์มการจอง
router.get('/new', ensureLeader, async (req, res) => {
    try {
        const [places] = await db.query('SELECT * FROM places');
        res.render('booking-new', { places, user: req.session.user });
    } catch (err) {
        console.error('GET /booking/new error:', err);
        res.status(500).send('Database error');
    }
});

// API ตรวจสอบเวลาทับซ้อน
router.get('/check', ensureLeader, async (req, res) => {
    try {
        const { place_id, date, time_start, time_end } = req.query;
        if (!place_id || !date || !time_start || !time_end) {
            return res.status(400).json({ conflict: false, message: 'ข้อมูลไม่ครบ' });
        }

        const [conflicts] = await db.query(
            `SELECT book_id, book_name, time FROM bookings 
             WHERE place_id = ? AND date = ? AND (
               ? <= SUBSTRING_INDEX(time, '-', -1) AND ? >= SUBSTRING_INDEX(time, '-', 1)
             )
             LIMIT 1`,
            [place_id, date, time_start, time_end]
        );

        if (conflicts.length > 0) {
            return res.json({ conflict: true, message: 'ช่วงเวลานี้ถูกจองแล้ว' });
        }
        return res.json({ conflict: false });
    } catch (err) {
        console.error('GET /booking/check error:', err);
        return res.status(500).json({ conflict: false, message: 'Server error' });
    }
});

// รับข้อมูลการจอง
router.post('/', ensureLeader, async (req, res) => {
    const { book_name, place_id, student_id, date, time_start, time_end } = req.body;
    const time = `${time_start}-${time_end}`;
    try {
        // ตรวจสอบเวลาให้อยู่ในช่วง 08:00-18:00 และนาทีเป็น 00 หรือ 30 และเวลาเริ่มต้องน้อยกว่าสิ้นสุด
        const isValidTimeUnit = (t) => {
            const match = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(t);
            if (!match) return false;
            const [hh, mm] = t.split(':').map(Number);
            if (mm !== 0 && mm !== 30) return false;
            const minutes = hh * 60 + mm;
            const min = 8 * 60;   // 08:00
            const max = 18 * 60;  // 18:00
            return minutes >= min && minutes <= max;
        };

        if (!isValidTimeUnit(time_start) || !isValidTimeUnit(time_end)) {
            const [places] = await db.query('SELECT * FROM places');
            return res.status(400).render('booking-new', {
                places,
                user: req.session.user,
                error: 'เลือกเวลาได้เฉพาะ 08:00-18:00 และนาทีต้องเป็น 00 หรือ 30'
            });
        }

        // เวลาเริ่มต้องน้อยกว่าสิ้นสุด
        const [sh, sm] = time_start.split(':').map(Number);
        const [eh, em] = time_end.split(':').map(Number);
        if (eh * 60 + em <= sh * 60 + sm) {
            const [places] = await db.query('SELECT * FROM places');
            return res.status(400).render('booking-new', {
                places,
                user: req.session.user,
                error: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น'
            });
        }

        // ตรวจสอบ booking ซ้ำ (ทับช่วงเวลา หรือเวลาเท่ากัน) ในวันเดียวกันและสถานที่เดียวกัน
        // เงื่อนไขทับซ้อนแบบ inclusive: start <= existing_end AND end >= existing_start
        const [conflicts] = await db.query(
            `SELECT * FROM bookings 
             WHERE place_id = ? AND date = ? AND (
               ? <= SUBSTRING_INDEX(time, '-', -1) AND ? >= SUBSTRING_INDEX(time, '-', 1)
             )`,
            [place_id, date, time_start, time_end]
        );
        if (conflicts.length > 0) {
            // มีการจองซ้อน
            const [places] = await db.query('SELECT * FROM places');
            return res.status(400).render('booking-new', {
                places,
                user: req.session.user,
                error: 'ช่วงเวลานี้ถูกจองแล้ว กรุณาเลือกช่วงเวลาอื่น'
            });
        }
        await db.query('INSERT INTO bookings (book_name, place_id, student_id, date, time) VALUES (?, ?, ?, ?, ?)',
            [book_name, place_id, student_id, date, time]);
        res.redirect('/booking?success=1');
    } catch (err) {
        console.error('POST /booking error:', err);
        res.status(500).send('Booking failed');
    }
});

module.exports = router; 