require('dotenv').config();


const express = require('express');
const app = express();
const session = require('express-session');
const path = require('path');
const cors = require("cors");
const bodyParser = require('body-parser');
const db = require('./db');
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts'); // เส้นทางสำหรับบทความ
const settingsRoutes = require('./routes/settings');
const notificationsRoutes = require('./routes/notifications');
const notificationsMiddleware = require('./middleware/notifications');
const MySQLStore = require('express-mysql-session')(session);
const multer = require('multer');
const fs = require('fs');
const bookingRouter = require('./routes/booking');
const dashboardRouter = require('./routes/dashboard');
const eventsRouter = require('./routes/events');



// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());


// ตั้งค่า Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'beaglelover',
  resave: false,
  saveUninitialized: true
}));
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});
// เสิร์ฟไฟล์สแตติก
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('public/uploads'));

// ตั้งค่า View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// เพิ่ม middleware สำหรับการแจ้งเตือน
app.use(notificationsMiddleware);

// ตั้งค่า multer สำหรับอัพโหลดรูปภาพ
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('กรุณาอัพโหลดไฟล์รูปภาพเท่านั้น'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // จำกัดขนาดไฟล์ 5MB
  }
});

// สร้างโฟลเดอร์ uploads ถ้ายังไม่มี
if (!fs.existsSync('public/uploads')) {
  fs.mkdirSync('public/uploads', { recursive: true });
}

// เพิ่ม upload middleware เข้าไปใน app
app.locals.upload = upload;

app.use('/auth', authRoutes);
app.use('/settings', settingsRoutes);
app.use('/posts', postRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/booking', bookingRouter);
app.use('/dashboard', dashboardRouter);
app.use('/events', eventsRouter);




// Middleware ตรวจสอบการล็อกอิน

// ---------------------- เส้นทางหลัก ----------------------
// หน้า Login
app.get('/', (req, res) => {
  res.render('auth/login', { error: null });
});

// หน้า Index (เฉพาะผู้ที่ล็อกอิน)
// ตัวอย่างใน app.js
app.get('/index', async (req, res) => {
  if (!req.session.user) return res.redirect('/');
  try {
    // ถ้าเป็นสมาชิกชมรมแล้ว ให้ redirect ไปหน้า show
    if (req.session.user.role !== 'admin') {
      const [membershipResult] = await db.query(
        'SELECT post_id FROM club_members WHERE user_id = ? AND (status = "approved" OR status = "pending") LIMIT 1',
        [req.session.user.id]
      );
      
      if (membershipResult.length > 0) {
        return res.redirect(`/posts/${membershipResult[0].post_id}`);
      }
    }

    const categoryId = req.query.category || ''; // รับค่า category จาก query parameter

    let query;
    let params = [];
    
    if (req.session.user.role === 'admin') {
      // admin เห็นชมรมทั้งหมด
      query = `
        SELECT DISTINCT p.*, u.username, c.name AS category_name 
        FROM posts p 
        JOIN users u ON p.user_id = u.id 
        JOIN categories c ON p.category_id = c.id
      `;
      
      if (categoryId) {
        query += ` WHERE p.category_id = ?`;
        params.push(categoryId);
      }
    } else {
      // user ทั่วไปเห็นเฉพาะชมรมที่ไม่ได้เป็นสมาชิกและไม่ได้สมัครแล้ว
      query = `
        SELECT DISTINCT p.*, u.username, c.name AS category_name 
        FROM posts p 
        JOIN users u ON p.user_id = u.id 
        JOIN categories c ON p.category_id = c.id
        WHERE p.id NOT IN (
          SELECT post_id FROM club_members WHERE user_id = ? AND (status = 'approved' OR status = 'pending')
        )
        AND p.user_id != ?
      `;
      params = [req.session.user.id, req.session.user.id];
      
      if (categoryId) {
        query += ` AND p.category_id = ?`;
        params.push(categoryId);
      }
    }

    query += ` ORDER BY p.created_at DESC`;

    const [posts] = await db.query(query, params);
    const [categories] = await db.query(`SELECT * FROM categories`); // ดึงรายการ category ทั้งหมด

    res.render('pages/index', {
      posts,
      categories,
      selectedCategory: categoryId,
      user: req.session.user,
      req
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.render('pages/index', {
      posts: [],
      categories: [],
      selectedCategory: '',
      user: req.session.user,
      req
    });
  }
});


// ค้นหาบทความ (ค้นหาจาก title)
app.get('/index/search', async (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const { keyword } = req.query;
  try {
    // ถ้าเป็นสมาชิกชมรมแล้ว ให้ redirect ไปหน้า show
    if (req.session.user.role !== 'admin') {
      const [membershipResult] = await db.query(
        'SELECT post_id FROM club_members WHERE user_id = ? AND (status = "approved" OR status = "pending") LIMIT 1',
        [req.session.user.id]
      );
      
      if (membershipResult.length > 0) {
        return res.redirect(`/posts/${membershipResult[0].post_id}`);
      }
    }

    let query;
    let params = [];
    
    if (req.session.user.role === 'admin') {
      // admin ค้นหาชมรมทั้งหมด
      query = `
        SELECT DISTINCT p.*, u.username, c.name AS category_name 
        FROM posts p 
        JOIN users u ON p.user_id = u.id 
        JOIN categories c ON p.category_id = c.id
        WHERE p.title LIKE ?
        ORDER BY p.created_at DESC
      `;
      params = [`%${keyword}%`];
    } else {
      // user ทั่วไปค้นหาเฉพาะชมรมที่ไม่ได้เป็นสมาชิกและไม่ได้สมัครแล้ว
      query = `
        SELECT DISTINCT p.*, u.username, c.name AS category_name 
        FROM posts p 
        JOIN users u ON p.user_id = u.id 
        JOIN categories c ON p.category_id = c.id
        WHERE p.title LIKE ?
        AND p.id NOT IN (
          SELECT post_id FROM club_members WHERE user_id = ? AND (status = 'approved' OR status = 'pending')
        )
        AND p.user_id != ?
        ORDER BY p.created_at DESC
      `;
      params = [`%${keyword}%`, req.session.user.id, req.session.user.id];
    }
    
    const [posts] = await db.query(query, params);

    const [categories] = await db.query(`SELECT * FROM categories`);

    res.render('pages/index', { 
      posts, 
      categories, 
      selectedCategory: '', 
      user: req.session.user, 
      keyword,
      req
    });
  } catch (error) {
    console.error('Error searching posts:', error);
    res.render('pages/index', { 
      posts: [], 
      categories: [], 
      selectedCategory: '', 
      user: req.session.user, 
      keyword: '',
      req
    });
  }
});





// เริ่มต้นเซิร์ฟเวอร์
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
