const db = require('../db');

async function fetchRecentNotifications(dbConn, userId, limit) {
  // จากสคีมาปัจจุบัน ตาราง notifications รองรับเฉพาะการแจ้งเตือนแบบระบุตัวผู้ใช้ (user_id)
  // จึงดึงเฉพาะรายการของผู้ใช้ปัจจุบัน โดยเรียงจากล่าสุด
  const [rows] = await dbConn.query(
    `SELECT id, user_id, post_id, message, is_read, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

async function fetchLeaderActionRequiredCount(dbConn, userId) {
  // นับคำขอเข้าชมรมที่รออนุมัติของชมรมที่ผู้ใช้เป็นเจ้าของ (leader ผ่าน posts.user_id)
  const [[{ cnt }]] = await dbConn.query(
    `SELECT COUNT(*) AS cnt
     FROM club_members cm
     JOIN posts p ON p.id = cm.post_id
     WHERE p.user_id = ? AND cm.status = 'pending'`,
    [userId]
  );
  return Number(cnt) || 0;
}

async function notificationsMiddleware(req, res, next) {
  try {
    const user = req.session.user;
    if (user) {
      // นับจำนวนที่ยังไม่ได้อ่าน (เฉพาะส่วนบุคคลตามสคีมา)
      const [[{ count: unreadCount }]] = await db.query(
        'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
        [user.id]
      );
      res.locals.unreadCount = Number(unreadCount) || 0;

      // รายการล่าสุด (เช่น 10 รายการ)
      res.locals.notifications = await fetchRecentNotifications(db, user.id, 10);

      // ตัวนับงานที่ต้องอนุมัติ (เฉพาะ leader)
      res.locals.actionRequiredCount = user.role === 'leader' ? await fetchLeaderActionRequiredCount(db, user.id) : 0;

      // สถานะเป็นสมาชิกชมรม
      const [[{ count: memberCount }]] = await db.query(
        'SELECT COUNT(*) AS count FROM club_members WHERE user_id = ? AND (status = "approved" OR status = "pending")',
        [user.id]
      );
      res.locals.isClubMember = Number(memberCount) > 0;
    } else {
      res.locals.unreadCount = 0;
      res.locals.notifications = [];
      res.locals.actionRequiredCount = 0;
      res.locals.isClubMember = false;
    }
    next();
  } catch (error) {
    console.error('Error in notifications middleware:', error);
    res.locals.unreadCount = 0;
    res.locals.notifications = [];
    res.locals.actionRequiredCount = 0;
    res.locals.isClubMember = false;
    next();
  }
}

module.exports = notificationsMiddleware;