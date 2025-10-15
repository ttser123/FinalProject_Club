const express = require('express');
const router = express.Router();
const db = require('../db');

// Require auth for all dashboard views
router.get('/', async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/auth/login');
    const role = req.session.user.role;
    if (role === 'admin') {
      // Admin overview
      const [[{ totalClubs }]] = await db.query('SELECT COUNT(*) AS totalClubs FROM posts');
      const [[{ totalMembers }]] = await db.query("SELECT COUNT(*) AS totalMembers FROM club_members WHERE status = 'approved'");
      const [[{ totalBookings }]] = await db.query('SELECT COUNT(*) AS totalBookings FROM bookings');

      // Monthly bookings for last 12 months
      const [rows] = await db.query(`
        SELECT DATE_FORMAT(date, '%Y-%m') as ym, COUNT(*) as cnt
        FROM bookings
        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY ym
        ORDER BY ym ASC
      `);
      const labels = rows.map(r => r.ym);
      const data = rows.map(r => r.cnt);

      return res.render('dashboard/admin', {
        totalClubs,
        totalMembers,
        totalBookings,
        chartLabels: labels,
        chartData: data
      });
    }

    if (role === 'leader') {
      // Leader: focus on clubs they lead
      const userId = req.session.user.id;
      const studentId = req.session.user.student_id;

      // Clubs they lead
      const [leaderClubs] = await db.query(
        `SELECT p.id, p.title FROM club_members cm JOIN posts p ON p.id = cm.post_id
         WHERE cm.user_id = ? AND cm.role = 'leader' AND cm.status = 'approved'`,
        [userId]
      );
      const clubIds = leaderClubs.map(c => c.id);

      let memberCount = 0;
      let pendingCount = 0;
      if (clubIds.length > 0) {
        const placeholders = clubIds.map(() => '?').join(',');
        const [[{ mc }]] = await db.query(
          `SELECT COUNT(*) mc FROM club_members WHERE status = 'approved' AND post_id IN (${placeholders})`,
          clubIds
        );
        memberCount = mc;
        const [[{ pc }]] = await db.query(
          `SELECT COUNT(*) pc FROM club_members WHERE status = 'pending' AND post_id IN (${placeholders})`,
          clubIds
        );
        pendingCount = pc;
      }

      // Bookings created by this leader (by student_id)
      const [[{ leaderBookings }]] = await db.query(
        'SELECT COUNT(*) leaderBookings FROM bookings WHERE student_id = ?',
        [studentId]
      );

      // Participation proxy: approved / (approved + pending)
      const participationRate = (memberCount + pendingCount) > 0
        ? Math.round((memberCount / (memberCount + pendingCount)) * 100)
        : 0;

      return res.render('dashboard/leader', {
        leaderClubs,
        memberCount,
        pendingCount,
        leaderBookings,
        participationRate
      });
    }

    // Member
    const userId = req.session.user.id;
    const studentId = req.session.user.student_id;

    const [[{ clubCount }]] = await db.query(
      "SELECT COUNT(*) clubCount FROM club_members WHERE user_id = ? AND status = 'approved'",
      [userId]
    );

    // Activities joined: real from event_participants attended
    const [[{ joinedActivities }]] = await db.query(
      "SELECT COUNT(*) joinedActivities FROM event_participants WHERE user_id = ? AND status = 'attended'",
      [userId]
    );

    // Sum points
    const [[{ totalPoints }]] = await db.query(
      'SELECT COALESCE(SUM(points),0) totalPoints FROM event_participants WHERE user_id = ? AND status = \"attended\"',
      [userId]
    );

    // Latest items: recent news from clubs they belong to
    const [latestNews] = await db.query(
      `SELECT n.*, p.title AS club_title
       FROM news n
       JOIN posts p ON p.id = n.post_id
       JOIN club_members cm ON cm.post_id = p.id AND cm.user_id = ? AND cm.status = 'approved'
       ORDER BY n.created_at DESC
       LIMIT 5`,
      [userId]
    );

    return res.render('dashboard/member', {
      clubCount,
      joinedActivities,
      latestNews,
      points: totalPoints
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลแดชบอร์ด');
  }
});

module.exports = router;


