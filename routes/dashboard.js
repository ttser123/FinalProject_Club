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
      const [[{ totalLeaders }]] = await db.query("SELECT COUNT(DISTINCT user_id) AS totalLeaders FROM club_members WHERE role = 'leader' AND status = 'approved'");
      const [[{ totalEvents }]] = await db.query('SELECT COUNT(*) AS totalEvents FROM events');
      const [[{ usedRooms }]] = await db.query("SELECT COUNT(*) AS usedRooms FROM places WHERE status = 'booked'");
      const [[{ availableRooms }]] = await db.query("SELECT COUNT(*) AS availableRooms FROM places WHERE status = 'available'");
      const [[{ totalPlaces }]] = await db.query('SELECT COUNT(*) AS totalPlaces FROM places');

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

      // Members per club (top 10)
      const [membersPerClubRows] = await db.query(`
        SELECT p.title AS name, COUNT(cm.user_id) AS cnt
        FROM posts p
        LEFT JOIN club_members cm ON cm.post_id = p.id AND cm.status = 'approved'
        GROUP BY p.id
        ORDER BY cnt DESC
        LIMIT 10`);
      const membersPerClubLabels = membersPerClubRows.map(r => r.name);
      const membersPerClubData = membersPerClubRows.map(r => r.cnt);

      // Events per club (top 10)
      const [eventsPerClubRows] = await db.query(`
        SELECT p.title AS name, COUNT(e.id) AS cnt
        FROM posts p
        LEFT JOIN events e ON e.post_id = p.id
        GROUP BY p.id
        ORDER BY cnt DESC
        LIMIT 10`);
      const eventsPerClubLabels = eventsPerClubRows.map(r => r.name);
      const eventsPerClubData = eventsPerClubRows.map(r => r.cnt);

      // Monthly room usage percentage (last 6 months)
      const [usageRows] = await db.query(`
        SELECT DATE_FORMAT(date, '%Y-%m') AS ym, COUNT(*) AS cnt
        FROM bookings
        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY ym
        ORDER BY ym ASC`);
      const usageLabels = usageRows.map(r => r.ym);
      const usagePercents = usageRows.map(r => {
        const denom = Math.max((Number(totalPlaces) || 1) * 30, 1); // approx capacity per month
        return Math.min(100, Math.round((Number(r.cnt || 0) / denom) * 100));
      });

      // Recent admin notifications (latest 5)
      const [recentNotifications] = await db.query(
        `SELECT id, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
        [req.session.user.id]
      );

      return res.render('dashboard/admin', {
        totalClubs,
        totalMembers,
        totalBookings,
        totalLeaders,
        totalEvents,
        usedRooms,
        availableRooms,
        chartLabels: labels,
        chartData: data,
        membersPerClubLabels,
        membersPerClubData,
        eventsPerClubLabels,
        eventsPerClubData,
        usageLabels,
        usagePercents,
        recentNotifications
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

      // Events counts for their clubs
      let eventsUpcoming = 0;
      let eventsPast = 0;
      if (clubIds.length > 0) {
        const placeholders2 = clubIds.map(() => '?').join(',');
        const [[{ eu }]] = await db.query(
          `SELECT COUNT(*) eu
           FROM events e
           JOIN bookings b ON b.book_id = e.booking_id
           WHERE e.post_id IN (${placeholders2})
             AND b.date >= CURDATE()
             AND e.is_canceled = 0`,
          clubIds
        );
        eventsUpcoming = eu;
        const [[{ ep }]] = await db.query(
          `SELECT COUNT(*) ep
           FROM events e
           JOIN bookings b ON b.book_id = e.booking_id
           WHERE e.post_id IN (${placeholders2})
             AND (b.date < CURDATE() OR e.is_ended = 1)`,
          clubIds
        );
        eventsPast = ep;
      }

      // Upcoming events list (next 5)
      const [upcomingEvents] = clubIds.length > 0 ? await db.query(
        `SELECT e.id, e.title, b.date AS date, e.time_start, e.time_end
         FROM events e
         JOIN bookings b ON b.book_id = e.booking_id
         WHERE e.post_id IN (${clubIds.map(()=>'?').join(',')}) AND b.date >= CURDATE() AND e.is_canceled = 0
         ORDER BY b.date ASC, e.time_start ASC
         LIMIT 5`,
        clubIds
      ) : [ [] ];

      // Participation proxy: approved / (approved + pending)
      const participationRate = (memberCount + pendingCount) > 0
        ? Math.round((memberCount / (memberCount + pendingCount)) * 100)
        : 0;

      return res.render('dashboard/leader', {
        leaderClubs,
        memberCount,
        pendingCount,
        leaderBookings,
        participationRate,
        eventsUpcoming,
        eventsPast,
        upcomingEvents
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

    // Attendance trend (last 6 months) and average
    const [attRows] = await db.query(
      `SELECT DATE_FORMAT(b.date, '%Y-%m') ym, COUNT(*) cnt
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
       JOIN bookings b ON b.book_id = e.booking_id
       WHERE ep.user_id = ? AND ep.status = 'attended' AND b.date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY ym
       ORDER BY ym ASC`,
      [userId]
    );
    const attLabels = attRows.map(r => r.ym);
    const attData = attRows.map(r => r.cnt);
    const [avgRows] = await db.query(
      `SELECT ym, AVG(cnt) avg_cnt FROM (
         SELECT ep.user_id, DATE_FORMAT(b.date, '%Y-%m') ym, COUNT(*) cnt
         FROM event_participants ep
         JOIN events e ON e.id = ep.event_id
         JOIN bookings b ON b.book_id = e.booking_id
         WHERE ep.status = 'attended' AND b.date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY ep.user_id, ym
       ) t
       GROUP BY ym
       ORDER BY ym ASC`
    );
    const avgData = avgRows.map(r => Number(r.avg_cnt || 0));

    return res.render('dashboard/member', {
      clubCount,
      joinedActivities,
      latestNews,
      points: totalPoints,
      attLabels,
      attData,
      avgData
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลแดชบอร์ด');
  }
});

module.exports = router;


