const express = require('express');
const router = express.Router();
const db = require('../db');

function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/');
}

// Helper: ตรวจสอบว่าสามารถเห็น noti แถวนี้ได้หรือไม่ (จากสคีมาปัจจุบัน: เฉพาะ user_id)
async function canViewNotification(id, userId) {
  const [[row]] = await db.query('SELECT id FROM notifications WHERE id = ? AND user_id = ? LIMIT 1', [id, userId]);
  return !!row;
}

// GET /notifications — หน้าแบบมีการแบ่งหน้า
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const pageSize = 10;
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const offset = (page - 1) * pageSize;

    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?',
      [req.session.user.id]
    );
    const [rows] = await db.query(
      `SELECT id, user_id, post_id, message, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [req.session.user.id, pageSize, offset]
    );

    const totalPages = Math.max(Math.ceil((Number(total) || 0) / pageSize), 1);
    res.render('notifications', { notifications: rows, page, totalPages });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.render('notifications', { notifications: [], page: 1, totalPages: 1 });
  }
});

// GET /api/notifications — สำหรับ dropdown ล่าสุด
router.get('/api/notifications', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, user_id, post_id, message, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.session.user.id]
    );
    const [[{ cnt }]] = await db.query(
      'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.session.user.id]
    );
    res.json({ notifications: rows, unreadCount: Number(cnt) || 0 });
  } catch (error) {
    console.error('Error fetching notifications (api):', error);
    res.status(500).json({ notifications: [], unreadCount: 0 });
  }
});

// POST /api/notifications/:id/read — ทำเครื่องหมายรายการเดียวว่าอ่านแล้ว
router.post('/api/notifications/:id/read', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    const canView = await canViewNotification(id, req.session.user.id);
    if (!canView) return res.status(404).json({ error: 'not found' });

    await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.session.user.id]);
    const [[{ cnt }]] = await db.query(
      'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.session.user.id]
    );
    res.json({ ok: true, unreadCount: Number(cnt) || 0 });
  } catch (error) {
    console.error('Error marking notification as read (api):', error);
    res.status(500).json({ ok: false });
  }
});

// POST /api/notifications/mark-all-read — อ่านทั้งหมดของผู้ใช้ปัจจุบัน
router.post('/api/notifications/mark-all-read', isAuthenticated, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.session.user.id]);
    res.json({ ok: true, unreadCount: 0 });
  } catch (error) {
    console.error('Error mark all as read (api):', error);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;