// routes/settings.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware ตรวจสอบการล็อกอิน
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/');
}

// หน้า Settings
router.get('/', isAuthenticated, (req, res) => {
  res.render('settings', { user: req.session.user });
});

// อัปเดต settings โดยรองรับการแก้ไข email ด้วย
router.post('/update', isAuthenticated, async (req, res) => {
  const { f_name, l_name, email, phone } = req.body;
  try {
    // อัปเดตข้อมูลในฐานข้อมูล
    await db.query(
      'UPDATE users SET f_name = ?, l_name = ?, email = ?, phone = ? WHERE id = ?',
      [f_name, l_name, email, phone, req.session.user.id]
    );
    // อัปเดต session ด้วยข้อมูลใหม่
    req.session.user.f_name = f_name;
    req.session.user.l_name = l_name;
    req.session.user.email = email;
    req.session.user.phone = phone;
    res.redirect('/settings');
  } catch (error) {
    console.error('Error updating settings:', error);
    res.render('settings', { user: req.session.user, error: 'เกิดข้อผิดพลาดในการอัปเดต' });
  }
});

module.exports = router;
