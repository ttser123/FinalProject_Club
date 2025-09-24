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

// แสดงหน้าจองห้อง
router.get('/', ensureLeader, async (req, res) => {
    try {
        const [places] = await db.query('SELECT * FROM places');
        res.render('booking', { places, success: req.query.success, user: req.session.user });
    } catch (err) {
        console.error('GET /booking error:', err);
        res.status(500).send('Database error');
    }
});

// รับข้อมูลการจอง
router.post('/', ensureLeader, async (req, res) => {
    const { book_name, place_id, student_id, date, time_start, time_end } = req.body;
    const time = `${time_start}-${time_end}`;
    try {
        // ตรวจสอบ booking ซ้ำ (ช่วงเวลาทับกัน)
        const [conflicts] = await db.query(
            `SELECT * FROM bookings WHERE place_id = ? AND date = ? AND (
                (? < SUBSTRING_INDEX(time, '-', -1) AND ? > SUBSTRING_INDEX(time, '-', 1))
            )`,
            [place_id, date, time_end, time_start]
        );
        if (conflicts.length > 0) {
            // มีการจองซ้อน
            const [places] = await db.query('SELECT * FROM places');
            return res.render('booking', {
                places,
                success: undefined,
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