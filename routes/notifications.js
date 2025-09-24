const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware ตรวจสอบการล็อกอิน
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/');
}

// แสดงหน้าการแจ้งเตือน
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const [notifications] = await db.query(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [req.session.user.id]
    );
    res.render('notifications', { notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.render('notifications', { notifications: [] });
  }
});

// ทำเครื่องหมายว่าอ่านแล้ว
router.post('/:id/read', isAuthenticated, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.user.id]
    );
    res.redirect('/notifications');
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.redirect('/notifications');
  }
});

module.exports = router; 