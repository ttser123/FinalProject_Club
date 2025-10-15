const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAuthenticated, isAdmin, isLeader, ensureAdminOrLeader } = require('../middleware/auth');
const db = require('../db');
// Ensure posts has line_group_url column
async function ensureLineGroupColumn() {
  await db.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS line_group_url VARCHAR(500) NULL");
}

// Middleware to ensure column
router.use(async (req, res, next) => {
  try { await ensureLineGroupColumn(); } catch (e) {}
  next();
});

// กำหนดค่า multer สำหรับการอัปโหลดไฟล์
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// ตรวจสอบประเภทไฟล์
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('ไม่รองรับประเภทไฟล์นี้'), false);
  }
};

// แสดงรายการบทความทั้งหมด (แสดงข้อมูลที่มีความสัมพันธ์ระหว่าง posts, users และ categories)
// แสดงรายการโพสต์ของผู้ใช้ที่ล็อกอินอยู่เท่านั้น
router.get('/', async (req, res) => {
  try {
    // ตรวจสอบว่ามีการล็อกอินหรือไม่
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }

    // ถ้าเป็น admin ให้ redirect ไปหน้า "ชมรมทั้งหมด"
    if (req.session.user.role === 'admin') {
      return res.redirect('/index');
    }

    // ดึงข้อมูลโพสต์ที่ผู้ใช้เป็นสมาชิกหรือเป็นเจ้าของ
    const [posts] = await db.query(`
      SELECT DISTINCT p.*, c.name as category_name, u.username as author_name,
             (SELECT COUNT(*) FROM club_members WHERE post_id = p.id AND status = 'approved') as member_count,
             cm.status as membership_status
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN club_members cm ON p.id = cm.post_id
      WHERE (cm.user_id = ? AND (cm.status = 'approved' OR cm.status = 'pending'))
         OR p.user_id = ?
      ORDER BY p.created_at DESC
    `, [req.session.user.id, req.session.user.id]);

    // ถ้าเป็นสมาชิกชมรมแล้ว ให้ redirect ไปหน้า show ของชมรมนั้น
    if (posts.length === 1) {
      return res.redirect(`/posts/${posts[0].id}`);
    }

    // Upcoming open events for this user (member of club), exclude canceled, only future or today later
    const [upcomingEvents] = await db.query(
      `SELECT e.*, p.title AS club_title, pl.place_name
       FROM events e
       JOIN posts p ON p.id = e.post_id
       JOIN bookings b ON b.book_id = e.booking_id
       JOIN places pl ON pl.place_id = b.place_id
       JOIN club_members cm ON cm.post_id = e.post_id AND cm.user_id = ? AND cm.status = 'approved'
       WHERE e.is_open = 1 AND (e.is_canceled IS NULL OR e.is_canceled = 0)
         AND (e.date > CURDATE() OR (e.date = CURDATE() AND e.time_end >= DATE_FORMAT(NOW(), '%H:%i')))
       ORDER BY e.date ASC, e.time_start ASC`,
      [req.session.user.id]
    );

    res.render('posts/myclub', { 
      posts,
      title: 'ชมรมของฉัน',
      req,
      upcomingEvents
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).render('error', { 
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลชมรม',
      error: error
    });
  }
});
  

// ฟอร์มเพิ่มบทความใหม่
router.get('/add', isAuthenticated, async (req, res) => {
  try {
    // ตรวจสอบว่าเป็น admin เท่านั้น
    if (req.session.user.role !== 'admin') {
      return res.status(403).send('เฉพาะ admin เท่านั้นที่สามารถสร้างชมรมได้');
    }
    
    // ดึงหมวดหมู่ทั้งหมดเพื่อให้เลือก
    const [categories] = await db.query(`SELECT * FROM categories ORDER BY name ASC`);
    res.render('posts/add', { categories, error: null });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).send('Internal Server Error');
  }
});

// สร้างบทความใหม่
router.post('/add', upload.single('cover_image'), async (req, res) => {
  try {
    // ตรวจสอบว่าเป็น admin เท่านั้น
    if (req.session.user.role !== 'admin') {
      return res.status(403).send('เฉพาะ admin เท่านั้นที่สามารถสร้างชมรมได้');
    }
    
    const { title, content, category_id, member_limit, club_leader_student_id } = req.body;
    const userId = req.session.user.id;
    const coverImage = req.file ? req.file.filename : null;

    // ตรวจสอบว่านิสิตหัวหน้าชมรมมีอยู่ในระบบหรือไม่
    const [leaderUser] = await db.query(
      'SELECT id, f_name, l_name FROM users WHERE student_id = ?',
      [club_leader_student_id]
    );

    if (leaderUser.length === 0) {
      return res.status(400).send('ไม่พบนิสิตรหัสนี้ในระบบ');
    }

    const leaderUserId = leaderUser[0].id;

    // ตรวจสอบว่านิสิตคนนี้มีอีเมลมหาลัยหรือไม่
    const [leaderEmailResult] = await db.query(
      'SELECT email FROM users WHERE id = ?',
      [leaderUserId]
    );

    if (leaderEmailResult.length === 0) {
      return res.status(400).send('ไม่พบข้อมูลนิสิตหัวหน้าชมรม');
    }

    const leaderEmail = leaderEmailResult[0].email;
    
    // ตรวจสอบรูปแบบอีเมลมหาลัย
    const emailPattern = /^[0-9]{8}@go\.buu\.ac\.th$/;
    if (!emailPattern.test(leaderEmail)) {
      return res.status(400).send(`นิสิตรหัส ${club_leader_student_id} ต้องใช้อีเมลมหาลัย (รูปแบบ: 65160000@go.buu.ac.th)`);
    }

    // ตรวจสอบว่ารหัสนิสิตในอีเมลตรงกับรหัสนิสิตที่กรอก
    const emailStudentId = leaderEmail.split('@')[0];
    if (emailStudentId !== club_leader_student_id) {
      return res.status(400).send(`รหัสนิสิตในอีเมล (${emailStudentId}) ไม่ตรงกับรหัสนิสิตที่กรอก (${club_leader_student_id})`);
    }

    // ตรวจสอบว่านิสิตคนนี้เป็นหัวหน้าชมรมหรือสมาชิกชมรมอื่นอยู่แล้วหรือไม่
    const [existingMembership] = await db.query(
      'SELECT cm.*, p.title as club_title FROM club_members cm JOIN posts p ON cm.post_id = p.id WHERE cm.user_id = ? AND cm.status = "approved"',
      [leaderUserId]
    );

    if (existingMembership.length > 0) {
      const isLeader = existingMembership.some(m => m.role === 'leader');
      const clubNames = existingMembership.map(m => m.club_title).join(', ');
      
      if (isLeader) {
        return res.status(400).send(`นิสิตรหัส ${club_leader_student_id} เป็นหัวหน้าชมรม ${clubNames} อยู่แล้ว`);
      } else {
        return res.status(400).send(`นิสิตรหัส ${club_leader_student_id} เป็นสมาชิกชมรม ${clubNames} อยู่แล้ว`);
      }
    }

    // ตรวจสอบว่า admin ห้ามเป็นหัวหน้าชมรมเอง
    if (leaderUserId === userId) {
      // ดึงหมวดหมู่ทั้งหมดเพื่อให้เลือกใหม่
      const [categories] = await db.query(`SELECT * FROM categories ORDER BY name ASC`);
      return res.render('posts/add', { categories, error: 'Admin ไม่สามารถเป็นหัวหน้าชมรมเองได้ กรุณาเลือกนิสิตคนอื่นเป็นหัวหน้าชมรม' });
    }

    const [result] = await db.execute(
      'INSERT INTO posts (title, content, user_id, category_id, member_limit, cover_image) VALUES (?, ?, ?, ?, ?, ?)',
      [title, content, userId, category_id, member_limit, coverImage]
    );

    // เพิ่มเจ้าของชมรมเป็นสมาชิกคนแรกในฐานะผู้ดูแล
    await db.execute(
      'INSERT INTO club_members (post_id, user_id, status, role) VALUES (?, ?, ?, ?)',
      [result.insertId, userId, 'approved', 'admin']
    );

    // เพิ่มหัวหน้าชมรมที่กำหนด
    await db.execute(
      'INSERT INTO club_members (post_id, user_id, status, role) VALUES (?, ?, ?, ?)',
      [result.insertId, leaderUserId, 'approved', 'leader']
    );

    // อัพเดท role ของหัวหน้าชมรมในตาราง users
    await db.execute(
      'UPDATE users SET role = "leader" WHERE id = ?',
      [leaderUserId]
    );

    res.redirect('/posts');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// API สำหรับตรวจสอบรหัสนิสิตหัวหน้าชมรม
router.post('/api/check-student-leader', isAuthenticated, async (req, res) => {
  try {
    const { student_id } = req.body;
    
    if (!student_id) {
      return res.status(400).json({ error: 'กรุณาระบุรหัสนิสิต' });
    }

    // ตรวจสอบรูปแบบรหัสนิสิต (8 หลัก)
    if (!/^\d{8}$/.test(student_id)) {
      return res.json({
        exists: false,
        is_leader: false,
        is_member: false,
        has_university_email: false,
        email_matches_student_id: false,
        message: 'รหัสนิสิตต้องเป็นตัวเลข 8 หลัก'
      });
    }

    // ตรวจสอบว่านิสิตรหัสนี้มีอยู่ในระบบหรือไม่
    const [userResult] = await db.query(
      'SELECT id, f_name, l_name, email FROM users WHERE student_id = ?',
      [student_id]
    );

    if (userResult.length === 0) {
      return res.json({ 
        exists: false, 
        is_leader: false, 
        is_member: false,
        has_university_email: false,
        email_matches_student_id: false,
        message: 'ไม่พบนิสิตรหัสนี้ในระบบ'
      });
    }

    const user = userResult[0];
    const userEmail = user.email;
    
    // ตรวจสอบรูปแบบอีเมลมหาลัย
    const emailPattern = /^[0-9]{8}@go\.buu\.ac\.th$/;
    const hasUniversityEmail = emailPattern.test(userEmail);
    
    // ตรวจสอบว่ารหัสนิสิตในอีเมลตรงกับรหัสนิสิตที่กรอก
    const emailStudentId = userEmail ? userEmail.split('@')[0] : '';
    const emailMatchesStudentId = emailStudentId === student_id;

    // ตรวจสอบว่านิสิตคนนี้เป็นหัวหน้าชมรมอยู่แล้วหรือไม่
    const [leaderResult] = await db.query(
      'SELECT cm.*, p.title as club_title FROM club_members cm JOIN posts p ON cm.post_id = p.id WHERE cm.user_id = ? AND cm.role = "leader" AND cm.status = "approved"',
      [user.id]
    );

    // ตรวจสอบว่านิสิตคนนี้เป็นสมาชิกชมรมอื่นอยู่แล้วหรือไม่
    const [memberResult] = await db.query(
      'SELECT cm.*, p.title as club_title FROM club_members cm JOIN posts p ON cm.post_id = p.id WHERE cm.user_id = ? AND cm.status = "approved"',
      [user.id]
    );

    return res.json({
      exists: true,
      is_leader: leaderResult.length > 0,
      is_member: memberResult.length > 0,
      has_university_email: hasUniversityEmail,
      email_matches_student_id: emailMatchesStudentId,
      user_info: {
        name: `${user.f_name} ${user.l_name}`,
        student_id: student_id,
        email: userEmail
      },
      leader_clubs: leaderResult.map(r => r.club_title),
      member_clubs: memberResult.map(r => r.club_title),
      message: hasUniversityEmail && emailMatchesStudentId && !leaderResult.length && !memberResult.length 
        ? 'นิสิตรหัสนี้สามารถเป็นหัวหน้าชมรมได้' 
        : 'นิสิตรหัสนี้ไม่สามารถเป็นหัวหน้าชมรมได้'
    });

  } catch (error) {
    console.error('Error checking student leader:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการตรวจสอบ',
      message: error.message 
    });
  }
});

// ฟอร์มแก้ไขบทความ
router.get('/:id/edit', isAuthenticated, async (req, res) => {
  const postId = req.params.id;
  try {
    const [postResult] = await db.query('SELECT * FROM posts WHERE id = ?', [postId]);
    if (postResult.length === 0) {
      return res.status(404).send('ไม่พบบทความ');
    }
    const post = postResult[0];
    // ตรวจสอบเฉพาะเจ้าของบทความหรือ admin เท่านั้น
    if (post.user_id !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).send('ไม่อนุญาตให้แก้ไขบทความนี้');
    }
    const [categories] = await db.query(`SELECT * FROM categories ORDER BY name ASC`);
    res.render('posts/edit', { post, categories, error: null });
  } catch (error) {
    console.error('Error fetching post for edit:', error);
    res.status(500).send('Internal Server Error');
  }
});

// แก้ไขบทความ
router.post('/:id/edit', isAuthenticated, async (req, res) => {
  const postId = req.params.id;
  const { title, content, category_id } = req.body;
  
  console.log('Edit request:', {
    postId,
    title,
    content,
    category_id,
    userId: req.session.user.id,
    userRole: req.session.user.role
  });

  try {
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!title || !content || !category_id) {
      throw new Error('กรุณากรอกข้อมูลให้ครบถ้วน');
    }

    // ตรวจสอบสิทธิ์ก่อนแก้ไข
    const [postResult] = await db.query('SELECT * FROM posts WHERE id = ?', [postId]);
    if (postResult.length === 0) {
      throw new Error('ไม่พบบทความ');
    }
    const post = postResult[0];
    if (post.user_id !== req.session.user.id && req.session.user.role !== 'admin') {
      throw new Error('ไม่อนุญาตให้แก้ไขบทความนี้');
    }

    // ตรวจสอบว่าหมวดหมู่มีอยู่จริง
    const [categoryResult] = await db.query('SELECT id FROM categories WHERE id = ?', [category_id]);
    if (categoryResult.length === 0) {
      throw new Error('ไม่พบหมวดหมู่ที่เลือก');
    }

    // Update post
    const [updateResult] = await db.query(
      'UPDATE posts SET title = ?, content = ?, category_id = ? WHERE id = ?',
      [title, content, category_id, postId]
    );

    if (updateResult.affectedRows === 0) {
      throw new Error('ไม่สามารถอัพเดทข้อมูลได้');
    }

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Detailed error:', error);
    // ดึงข้อมูลหมวดหมู่ใหม่เพื่อแสดงในฟอร์ม
    const [categories] = await db.query(`SELECT * FROM categories ORDER BY name ASC`);
    res.render('posts/edit', { 
      error: error.message || 'เกิดข้อผิดพลาดในการแก้ไขบทความ', 
      post: { ...req.body, id: postId }, 
      categories 
    });
  }
});

// ลบบทความ
router.post('/delete/:id', isAuthenticated, async (req, res) => {
  const postId = req.params.id;
  try {
    // ตรวจสอบสิทธิ์ก่อนลบ
    const [postResult] = await db.query('SELECT * FROM posts WHERE id = ?', [postId]);
    if (postResult.length === 0) {
      return res.status(404).send('ไม่พบบทความ');
    }
    const post = postResult[0];
    if (req.session.user.role !== 'admin') {
      return res.status(403).send('เฉพาะ admin เท่านั้นที่สามารถลบชมรมได้');
    }
    await db.query('DELETE FROM posts WHERE id = ?', [postId]);
    res.redirect('/posts');
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).send('Internal Server Error');
  }
});

// แสดงรายละเอียดบทความ
router.get('/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const [rows] = await db.execute(
      'SELECT posts.*, users.username, users.f_name, users.l_name, users.student_id, categories.name AS category_name FROM posts JOIN users ON posts.user_id = users.id JOIN categories ON posts.category_id = categories.id WHERE posts.id = ?',
      [postId]
    );

    if (rows.length === 0) {
      return res.status(404).send('Post not found');
    }

    const post = rows[0];
    let isMember = false;
    let memberStatus = null;
    let memberRole = null;
    let pendingMembers = [];
    let approvedMembers = [];

    if (req.session.user) {
      // ตรวจสอบว่าผู้ใช้เป็นสมาชิกของชมรมนี้หรือไม่
      const [memberResult] = await db.query(
        'SELECT status, role FROM club_members WHERE post_id = ? AND user_id = ?',
        [postId, req.session.user.id]
      );
      
      if (memberResult.length > 0) {
        isMember = true;
        memberStatus = memberResult[0].status;
        memberRole = memberResult[0].role;
      }

      // ถ้าเป็นเจ้าของชมรมหรือหัวหน้าชมรม ให้ดึงรายชื่อผู้ที่สมัครรอการอนุมัติ
      if (req.session.user.id === post.user_id || req.session.user.role === 'leader') {
        const [pendingResult] = await db.query(
          `SELECT u.id, u.f_name, u.l_name, u.student_id, cm.created_at 
           FROM club_members cm 
           JOIN users u ON cm.user_id = u.id 
           WHERE cm.post_id = ? AND cm.status = 'pending' 
           ORDER BY cm.created_at DESC`,
          [postId]
        );
        pendingMembers = pendingResult;
      }

      // ดึงรายชื่อสมาชิกที่อนุมัติแล้ว
      const [approvedResult] = await db.query(
        `SELECT u.id, u.f_name, u.l_name, u.student_id, cm.role, cm.created_at,
                CASE WHEN p.user_id = u.id THEN 1 ELSE 0 END as is_owner
         FROM club_members cm 
         JOIN users u ON cm.user_id = u.id 
         JOIN posts p ON cm.post_id = p.id
         WHERE cm.post_id = ? AND cm.status = 'approved' 
         ORDER BY FIELD(cm.role, 'admin', 'leader', 'member'), cm.created_at DESC`,
        [postId]
      );
      approvedMembers = approvedResult;
    }

    // ดึงข้อมูลข่าวสาร
    const [news] = await db.query(
      'SELECT * FROM news WHERE post_id = ? ORDER BY created_at DESC',
      [postId]
    );

    // Fetch files for this post
    const [files] = await db.query(
      'SELECT * FROM files WHERE post_id = ? ORDER BY created_at DESC',
      [postId]
    );

    // ดึงข้อมูลการจองสถานที่ของหัวหน้าชมรมในชมรมนี้
    let bookings = [];
    try {
      const leaderStudentIds = approvedMembers
        .filter(m => m.role === 'leader')
        .map(m => m.student_id);
      if (leaderStudentIds.length > 0) {
        const placeholders = leaderStudentIds.map(() => '?').join(',');
        const [bookingRows] = await db.query(
          `SELECT CONCAT(u.f_name, ' ', u.l_name) AS reserver_name,
                  b.book_name,
                  pl.place_name AS place_name,
                  b.date,
                  b.time
           FROM bookings b
           JOIN users u ON u.student_id = b.student_id
           JOIN places pl ON pl.place_id = b.place_id
           WHERE b.student_id IN (${placeholders})
           ORDER BY b.date DESC, b.time DESC`,
          leaderStudentIds
        );
        bookings = bookingRows;
      }
    } catch (e) {
      console.error('Error fetching bookings:', e);
    }

    res.render('posts/show', {
      post,
      isMember,
      memberStatus,
      memberRole,
      pendingMembers,
      approvedMembers,
      news,
      files,
      bookings,
      req
    });
  } catch (error) {
    console.error('Error fetching post details:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ตั้งค่าลิงก์ช่องทางการสื่อสาร (leader/admin)
router.post('/:id/line', isAuthenticated, async (req, res) => {
  try {
    const postId = req.params.id;
    const { line_group_url } = req.body;
    // check permission: admin or leader in this club
    const [membership] = await db.query(
      `SELECT 1 FROM club_members WHERE post_id = ? AND user_id = ? AND status = 'approved'`,
      [postId, req.session.user.id]
    );
    if (membership.length === 0 && req.session.user.role !== 'admin') {
      return res.status(403).send('ไม่มีสิทธิ์');
    }
    // ยอมรับลิงก์ทั่วไป (http/https) เพื่อรองรับ LINE/Discord/Facebook/อื่นๆ
    if (!/^https?:\/\/.+/i.test(line_group_url)) {
      return res.status(400).send('กรุณากรอกลิงก์ที่ขึ้นต้นด้วย http:// หรือ https://');
    }
    await db.query('UPDATE posts SET line_group_url = ? WHERE id = ?', [line_group_url, postId]);
    res.redirect(`/posts/${postId}`);
  } catch (err) {
    console.error('POST /posts/:id/line error:', err);
    res.status(500).send('บันทึกลิงก์ล้มเหลว');
  }
});

// ลบลิงก์ LINE Group (admin)
router.post('/:id/line/delete', isAuthenticated, async (req, res) => {
  try {
    const postId = req.params.id;
    if (req.session.user.role !== 'admin') {
      return res.status(403).send('เฉพาะผู้ดูแลระบบเท่านั้น');
    }
    await db.query('UPDATE posts SET line_group_url = NULL WHERE id = ?', [postId]);
    res.redirect(`/posts/${postId}`);
  } catch (err) {
    console.error('POST /posts/:id/line/delete error:', err);
    res.status(500).send('ลบลิงก์ล้มเหลว');
  }
});

// อนุมัติการสมัครเข้าชมรม
router.post('/:postId/approve/:userId', isAuthenticated, async (req, res) => {
  try {
    const { postId, userId } = req.params;
    
    // ตรวจสอบว่าเป็นเจ้าของชมรม, admin หรือ leader
    const [postResult] = await db.query(
      'SELECT * FROM posts WHERE id = ? AND (user_id = ? OR ? IN ("admin", "leader"))',
      [postId, req.session.user.id, req.session.user.role]
    );

    if (postResult.length === 0) {
      return res.status(403).send('ไม่อนุญาตให้ดำเนินการ');
    }

    // อัพเดทสถานะเป็น approved
    await db.query(
      'UPDATE club_members SET status = "approved" WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    // สร้างการแจ้งเตือนให้ผู้สมัคร
    const [userResult] = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
    const [postTitle] = await db.query('SELECT title FROM posts WHERE id = ?', [postId]);
    
    if (userResult.length > 0 && postTitle.length > 0) {
      await db.query(
        'INSERT INTO notifications (user_id, post_id, message) VALUES (?, ?, ?)',
        [userId, postId, `การสมัครเข้าชมรม ${postTitle[0].title} ได้รับการอนุมัติแล้ว`]
      );
    }

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Error approving member:', error);
    res.status(500).send('Server error');
  }
});

// อนุมัติผู้สมัครทั้งหมด
router.post('/:postId/approve-all', isAuthenticated, async (req, res) => {
  try {
    const { postId } = req.params;
    
    // ตรวจสอบว่าเป็นเจ้าของชมรม, admin หรือ leader
    const [postResult] = await db.query(
      'SELECT * FROM posts WHERE id = ? AND (user_id = ? OR ? IN ("admin", "leader"))',
      [postId, req.session.user.id, req.session.user.role]
    );

    if (postResult.length === 0) {
      return res.status(403).send('ไม่อนุญาตให้ดำเนินการ');
    }

    // ดึงรายชื่อผู้สมัครที่รอการอนุมัติ
    const [pendingResult] = await db.query(
      'SELECT user_id FROM club_members WHERE post_id = ? AND status = "pending"',
      [postId]
    );

    if (pendingResult.length === 0) {
      return res.redirect(`/posts/${postId}`);
    }

    // อัพเดทสถานะเป็น approved สำหรับทุกคน
    await db.query(
      'UPDATE club_members SET status = "approved" WHERE post_id = ? AND status = "pending"',
      [postId]
    );

    // สร้างการแจ้งเตือนให้ผู้สมัครทุกคน
    const [postTitle] = await db.query('SELECT title FROM posts WHERE id = ?', [postId]);
    
    if (postTitle.length > 0) {
      const notificationPromises = pendingResult.map(pending => 
        db.query(
          'INSERT INTO notifications (user_id, post_id, message) VALUES (?, ?, ?)',
          [pending.user_id, postId, `การสมัครเข้าชมรม ${postTitle[0].title} ได้รับการอนุมัติแล้ว`]
        )
      );
      
      await Promise.all(notificationPromises);
    }

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Error approving all members:', error);
    res.status(500).send('Server error');
  }
});

// ปฏิเสธการสมัครเข้าชมรม
router.post('/:postId/reject/:userId', isAuthenticated, async (req, res) => {
  try {
    const { postId, userId } = req.params;
    
    // ตรวจสอบว่าเป็นเจ้าของชมรม, admin หรือ leader
    const [postResult] = await db.query(
      'SELECT * FROM posts WHERE id = ? AND (user_id = ? OR ? IN ("admin", "leader"))',
      [postId, req.session.user.id, req.session.user.role]
    );

    if (postResult.length === 0) {
      return res.status(403).send('ไม่อนุญาตให้ดำเนินการ');
    }

    // อัพเดทสถานะเป็น rejected
    await db.query(
      'UPDATE club_members SET status = "rejected" WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    // สร้างการแจ้งเตือนให้ผู้สมัคร
    const [userResult] = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
    const [postTitle] = await db.query('SELECT title FROM posts WHERE id = ?', [postId]);
    
    if (userResult.length > 0 && postTitle.length > 0) {
      await db.query(
        'INSERT INTO notifications (user_id, post_id, message) VALUES (?, ?, ?)',
        [userId, postId, `การสมัครเข้าชมรม ${postTitle[0].title} ถูกปฏิเสธ`]
      );
    }

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Error rejecting member:', error);
    res.status(500).send('Server error');
  }
});

// สมัครเข้าชมรม
router.post('/:id/join', isAuthenticated, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.session.user.id;

    // ตรวจสอบว่าผู้ใช้มีอีเมลมหาลัยหรือไม่
    const [userResult] = await db.query(
      'SELECT email, student_id FROM users WHERE id = ?',
      [userId]
    );

    if (userResult.length === 0) {
      return res.status(400).send('ไม่พบข้อมูลผู้ใช้');
    }

    const user = userResult[0];
    
    // ตรวจสอบรูปแบบอีเมลมหาลัย
    const emailPattern = /^[0-9]{8}@go\.buu\.ac\.th$/;
    if (!emailPattern.test(user.email)) {
      return res.status(400).send('กรุณาใช้อีเมลมหาลัยในการสมัครเข้าชมรม (รูปแบบ: 65160000@go.buu.ac.th)');
    }

    // ตรวจสอบว่ารหัสนิสิตในอีเมลตรงกับรหัสนิสิตในระบบ
    const emailStudentId = user.email.split('@')[0];
    if (emailStudentId !== user.student_id) {
      return res.status(400).send('รหัสนิสิตในอีเมลไม่ตรงกับรหัสนิสิตในระบบ');
    }

    // ตรวจสอบว่าสมัครชมรมอื่นไปแล้วหรือยัง
    const [existingMembership] = await db.query(
      'SELECT * FROM club_members WHERE user_id = ? AND (status = "pending" OR status = "approved")',
      [userId]
    );

    if (existingMembership.length > 0) {
      return res.status(400).send('คุณได้สมัครเข้าชมรมอื่นไปแล้ว กรุณายกเลิกการสมัครก่อน');
    }

    // ตรวจสอบว่าสมัครชมรมนี้ไปแล้วหรือยัง
    const [existingMember] = await db.query(
      'SELECT * FROM club_members WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    if (existingMember.length > 0) {
      return res.status(400).send('คุณได้สมัครเข้าชมรมนี้แล้ว');
    }

    // บันทึกการสมัคร
    await db.query(
      'INSERT INTO club_members (post_id, user_id, status) VALUES (?, ?, "pending")',
      [postId, userId]
    );

    // สร้างการแจ้งเตือนให้เจ้าของชมรม
    const [post] = await db.query('SELECT * FROM posts WHERE id = ?', [postId]);
    if (post.length > 0) {
      await db.query(
        'INSERT INTO notifications (user_id, post_id, message) VALUES (?, ?, ?)',
        [post[0].user_id, postId, `${req.session.user.f_name} ${req.session.user.l_name} สมัครเข้าชมรม ${post[0].title}`]
      );
    }

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Error joining club:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการสมัครเข้าชมรม');
  }
});

// ยกเลิกการสมัครเข้าชมรม
router.post('/:id/cancel-join', isAuthenticated, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.session.user.id;

    // ตรวจสอบว่าสมัครชมรมนี้และยังไม่ได้รับการอนุมัติหรือไม่
    const [existingMember] = await db.query(
      'SELECT * FROM club_members WHERE post_id = ? AND user_id = ? AND status = "pending"',
      [postId, userId]
    );

    if (existingMember.length === 0) {
      return res.status(400).send('ไม่พบการสมัครที่สามารถยกเลิกได้');
    }

    // ลบการสมัคร
    await db.query(
      'DELETE FROM club_members WHERE post_id = ? AND user_id = ? AND status = "pending"',
      [postId, userId]
    );

    // ตรวจสอบและ sync role ใน users ถ้าเป็นหัวหน้าชมรม
    const [isLeader] = await db.query(
      'SELECT * FROM club_members WHERE user_id = ? AND role = "leader"',
      [userId]
    );
    if (isLeader.length === 0) {
      // ไม่มีชมรมไหนที่เป็นหัวหน้าแล้ว ให้เปลี่ยน role ใน users เป็น member
      await db.query(
        'UPDATE users SET role = "member" WHERE id = ?',
        [userId]
      );
    }

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Error canceling join:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการยกเลิกการสมัคร');
  }
});

// แสดงรายการสมาชิกชมรม
router.get('/:id/members', isAuthenticated, async (req, res) => {
  try {
    const [post] = await db.query('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) {
      return res.status(404).send('Post not found');
    }

    // ตรวจสอบว่าเป็นเจ้าของชมรมหรือไม่
    if (post.user_id !== req.session.user.id) {
      return res.status(403).send('Unauthorized');
    }

    const [members] = await db.query(`
      SELECT u.*, pm.joined_at, pm.status
      FROM users u
      JOIN post_members pm ON u.id = pm.user_id
      WHERE pm.post_id = ?
      ORDER BY pm.joined_at DESC
    `, [req.params.id]);

    res.render('posts/members', { post, members });
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).send('Server Error');
  }
});

// ลบสมาชิกออกจากชมรม
router.post('/:postId/members/:userId/remove', isAuthenticated, async (req, res) => {
  try {
    const { postId, userId } = req.params;
    
    // ตรวจสอบว่าเป็นเจ้าของชมรม, admin หรือ leader
    const [postResult] = await db.query(
      'SELECT * FROM posts WHERE id = ? AND (user_id = ? OR ? IN ("admin", "leader"))',
      [postId, req.session.user.id, req.session.user.role]
    );

    if (postResult.length === 0) {
      return res.status(403).json({ error: 'ไม่อนุญาตให้ดำเนินการ' });
    }

    // ตรวจสอบว่าผู้ใช้ที่ต้องการลบเป็นเจ้าของชมรมหรือไม่
    const [isOwner] = await db.query(
      'SELECT * FROM posts WHERE id = ? AND user_id = ?',
      [postId, userId]
    );

    if (isOwner.length > 0) {
      return res.status(403).json({ error: 'ไม่สามารถลบเจ้าของชมรมได้' });
    }

    // ลบสมาชิกออกจากชมรม
    await db.query(
      'DELETE FROM club_members WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    // ตรวจสอบและ sync role ใน users ถ้าเป็นหัวหน้าชมรม
    const [isLeader] = await db.query(
      'SELECT * FROM club_members WHERE user_id = ? AND role = "leader"',
      [userId]
    );
    if (isLeader.length === 0) {
      // ไม่มีชมรมไหนที่เป็นหัวหน้าแล้ว ให้เปลี่ยน role ใน users เป็น member
      await db.query(
        'UPDATE users SET role = "member" WHERE id = ?',
        [userId]
      );
    }

    // สร้างการแจ้งเตือนให้สมาชิกที่ถูกลบ
    const [userResult] = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
    const [postTitle] = await db.query('SELECT title FROM posts WHERE id = ?', [postId]);
    
    if (userResult.length > 0 && postTitle.length > 0) {
      await db.query(
        'INSERT INTO notifications (user_id, post_id, message) VALUES (?, ?, ?)',
        [userId, postId, `คุณถูกถอดออกจากชมรม ${postTitle[0].title}`]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบสมาชิก' });
  }
});

// แสดงหน้าเพิ่มข่าวสาร
router.get('/:id/news/add', isAuthenticated, async (req, res) => {
  try {
    const postId = req.params.id;
    
    // ตรวจสอบสิทธิ์ (admin, leader, หรือเจ้าของชมรม)
    const [memberResult] = await db.query(
      `SELECT cm.role, p.user_id, p.* 
       FROM club_members cm 
       JOIN posts p ON cm.post_id = p.id 
       WHERE cm.post_id = ? AND cm.user_id = ? AND cm.status = "approved"`,
      [postId, req.session.user.id]
    );

    // อนุญาตเฉพาะ admin, leader, หรือเจ้าของชมรม
    if (memberResult.length === 0 || 
        (!['admin', 'leader'].includes(req.session.user.role) && 
         memberResult[0].user_id !== req.session.user.id)) {
      return res.status(403).send('ไม่มีสิทธิ์ในการเพิ่มข่าวสาร');
    }

    res.render('posts/add-news', { 
      post: memberResult[0],
      error: null
    });
  } catch (error) {
    console.error('Error showing add news form:', error);
    res.status(500).send('Internal Server Error');
  }
});

// เพิ่มข่าวสารใหม่
router.post('/:id/news', isAuthenticated, async (req, res) => {
  try {
    const postId = req.params.id;
    const { title, content, category } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!title || !content || !category) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    // ตรวจสอบสิทธิ์ (admin, leader, หรือเจ้าของชมรม)
    const [memberResult] = await db.query(
      `SELECT cm.role, p.user_id 
       FROM club_members cm 
       JOIN posts p ON cm.post_id = p.id 
       WHERE cm.post_id = ? AND cm.user_id = ? AND cm.status = "approved"`,
      [postId, req.session.user.id]
    );

    // อนุญาตเฉพาะ admin, leader, หรือเจ้าของชมรม
    if (memberResult.length === 0 || 
        (!['admin', 'leader'].includes(req.session.user.role) && 
         memberResult[0].user_id !== req.session.user.id)) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ในการเพิ่มข่าวสาร' });
    }

    // เพิ่มข่าวสาร
    await db.query(
      'INSERT INTO news (post_id, title, content, category) VALUES (?, ?, ?, ?)',
      [postId, title, content, category]
    );

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Error adding news:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเพิ่มข่าวสาร' });
  }
});

// แสดงหน้าแก้ไขข่าวสาร
router.get('/:id/news/:newsId/edit', isAuthenticated, async (req, res) => {
  try {
    const { id: postId, newsId } = req.params;
    
    // ตรวจสอบสิทธิ์ (admin, leader, หรือเจ้าของชมรม)
    const [memberResult] = await db.query(
      `SELECT cm.role, p.user_id, p.* 
       FROM club_members cm 
       JOIN posts p ON cm.post_id = p.id 
       WHERE cm.post_id = ? AND cm.user_id = ? AND cm.status = "approved"`,
      [postId, req.session.user.id]
    );

    // อนุญาตเฉพาะ admin, leader, หรือเจ้าของชมรม
    if (memberResult.length === 0 || 
        (!['admin', 'leader'].includes(req.session.user.role) && 
         memberResult[0].user_id !== req.session.user.id)) {
      return res.status(403).send('ไม่มีสิทธิ์ในการแก้ไขข่าวสาร');
    }

    // ดึงข้อมูลข่าวสาร
    const [newsResult] = await db.query(
      'SELECT * FROM news WHERE id = ? AND post_id = ?',
      [newsId, postId]
    );

    if (newsResult.length === 0) {
      return res.status(404).send('ไม่พบข่าวสาร');
    }

    res.render('posts/edit-news', { 
      post: memberResult[0],
      news: newsResult[0],
      error: null
    });
  } catch (error) {
    console.error('Error showing edit news form:', error);
    res.status(500).send('Internal Server Error');
  }
});

// แก้ไขข่าวสาร
router.post('/:id/news/:newsId/edit', isAuthenticated, async (req, res) => {
  try {
    const { id: postId, newsId } = req.params;
    const { title, content, category } = req.body;

    // ตรวจสอบสิทธิ์ (admin, leader, หรือเจ้าของชมรม)
    const [memberResult] = await db.query(
      `SELECT cm.role, p.user_id 
       FROM club_members cm 
       JOIN posts p ON cm.post_id = p.id 
       WHERE cm.post_id = ? AND cm.user_id = ? AND cm.status = "approved"`,
      [postId, req.session.user.id]
    );

    // อนุญาตเฉพาะ admin, leader, หรือเจ้าของชมรม
    if (memberResult.length === 0 || 
        (!['admin', 'leader'].includes(req.session.user.role) && 
         memberResult[0].user_id !== req.session.user.id)) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ในการแก้ไขข่าวสาร' });
    }

    // อัพเดทข่าวสาร
    await db.query(
      'UPDATE news SET title = ?, content = ?, category = ? WHERE id = ? AND post_id = ?',
      [title, content, category, newsId, postId]
    );

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Error updating news:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข่าวสาร' });
  }
});

// ลบข่าวสาร
router.post('/:id/news/:newsId/delete', isAuthenticated, async (req, res) => {
  try {
    const { id: postId, newsId } = req.params;

    // ตรวจสอบสิทธิ์ (admin, leader, หรือเจ้าของชมรม)
    const [memberResult] = await db.query(
      `SELECT cm.role, p.user_id 
       FROM club_members cm 
       JOIN posts p ON cm.post_id = p.id 
       WHERE cm.post_id = ? AND cm.user_id = ? AND cm.status = "approved"`,
      [postId, req.session.user.id]
    );

    // อนุญาตเฉพาะ admin, leader, หรือเจ้าของชมรม
    if (memberResult.length === 0 || 
        (!['admin', 'leader'].includes(req.session.user.role) && 
         memberResult[0].user_id !== req.session.user.id)) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ในการลบข่าวสาร' });
    }

    // ลบข่าวสาร
    await db.query('DELETE FROM news WHERE id = ? AND post_id = ?', [newsId, postId]);

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Error deleting news:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข่าวสาร' });
  }
});

// แสดงหน้าอัปโหลดไฟล์
router.get('/:id/files/upload', isAuthenticated, async (req, res) => {
  try {
    const postId = req.params.id;
    
    // ตรวจสอบสิทธิ์
    const [memberResult] = await db.query(
      `SELECT cm.role, p.user_id, p.* 
       FROM club_members cm 
       JOIN posts p ON cm.post_id = p.id 
       WHERE cm.post_id = ? AND cm.user_id = ? AND cm.status = "approved"`,
      [postId, req.session.user.id]
    );

    if (memberResult.length === 0 || 
        (!['admin', 'leader'].includes(req.session.user.role) && 
         memberResult[0].user_id !== req.session.user.id)) {
      return res.status(403).send('ไม่มีสิทธิ์ในการอัปโหลดไฟล์');
    }

    res.render('posts/upload-file', { 
      post: memberResult[0],
      error: null
    });
  } catch (error) {
    console.error('Error showing upload file form:', error);
    res.status(500).send('Internal Server Error');
  }
});

// อัปโหลดไฟล์
router.post('/:id/files', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.session.user.id;

    console.log('User ID:', userId);
    console.log('Post ID:', postId);

    // ตรวจสอบสิทธิ์การอัปโหลด
    const [post] = await db.query(
      'SELECT * FROM posts WHERE id = ?',
      [postId]
    );

    if (!post) {
      return res.status(404).send('ไม่พบโพสต์');
    }

    console.log('Post:', post);

    // ตรวจสอบว่าผู้ใช้เป็นผู้ดูแลหรือผู้ช่วย
    const [members] = await db.query(
      `SELECT cm.role, cm.status 
       FROM club_members cm 
       WHERE cm.post_id = ? AND cm.user_id = ? AND cm.status = "approved"`,
      [postId, userId]
    );

    console.log('Members:', members);

    const member = members[0];
    if (!member || !['admin', 'leader'].includes(req.session.user.role)) {
      console.log('Permission denied. Member:', member);
      return res.status(403).send('เฉพาะ admin และ leader เท่านั้นที่สามารถอัปโหลดไฟล์ได้');
    }

    if (!req.file) {
      return res.status(400).send('กรุณาเลือกไฟล์');
    }

    // บันทึกข้อมูลไฟล์ลงฐานข้อมูล
    const [result] = await db.query(
      'INSERT INTO files (post_id, filename, originalname, display_name, description, size) VALUES (?, ?, ?, ?, ?, ?)',
      [
        postId,
        req.file.filename,
        req.file.originalname,
        req.body.displayName,
        req.body.description,
        req.file.size
      ]
    );

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการอัปโหลดไฟล์: ' + error.message);
  }
});

// ลบไฟล์
router.post('/:id/files/:fileId/delete', isAuthenticated, async (req, res) => {
  try {
    const postId = req.params.id;
    const fileId = req.params.fileId;
    const userId = req.session.user.id;

    // ตรวจสอบสิทธิ์การลบไฟล์
    const [post] = await db.query(
      'SELECT * FROM posts WHERE id = ?',
      [postId]
    );

    if (!post) {
      return res.status(404).send('ไม่พบโพสต์');
    }

    // ตรวจสอบว่าผู้ใช้เป็นผู้ดูแลหรือผู้ช่วย
    const [members] = await db.query(
      `SELECT cm.role, cm.status 
       FROM club_members cm 
       WHERE cm.post_id = ? AND cm.user_id = ? AND cm.status = "approved"`,
      [postId, userId]
    );

    const member = members[0];
    if (!member || !['admin', 'leader'].includes(req.session.user.role)) {
      return res.status(403).send('เฉพาะ admin และ leader เท่านั้นที่สามารถลบไฟล์ได้');
    }

    // ดึงข้อมูลไฟล์
    const [files] = await db.query(
      'SELECT * FROM files WHERE id = ? AND post_id = ?',
      [fileId, postId]
    );

    if (files.length === 0) {
      return res.status(404).send('ไม่พบไฟล์');
    }

    const file = files[0];

    // ลบไฟล์จากระบบ
    const filePath = path.join(__dirname, '../public/uploads', file.filename);
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting file:', err);
      }
    });

    // ลบข้อมูลไฟล์จากฐานข้อมูล
    await db.query(
      'DELETE FROM files WHERE id = ?',
      [fileId]
    );

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการลบไฟล์');
  }
});

module.exports = router;
