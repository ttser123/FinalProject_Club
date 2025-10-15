const db = require('../db');

async function notificationsMiddleware(req, res, next) {
  try {
    if (req.session.user) {
      // นับจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
      const [result] = await db.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
        [req.session.user.id]
      );
      res.locals.unreadCount = result[0].count;

      // เช็คว่าผู้ใช้เป็นสมาชิกชมรมหรือยัง
      const [membershipResult] = await db.query(
        'SELECT COUNT(*) as count FROM club_members WHERE user_id = ? AND (status = "approved" OR status = "pending")',
        [req.session.user.id]
      );
      res.locals.isClubMember = membershipResult[0].count > 0;
    } else {
      res.locals.unreadCount = 0;
      res.locals.isClubMember = false;
    }
    next();
  } catch (error) {
    console.error('Error in notifications middleware:', error);
    res.locals.unreadCount = 0;
    res.locals.isClubMember = false;
    next();
  }
}

module.exports = notificationsMiddleware; 