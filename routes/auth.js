const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');

const EMAIL_PATTERN = /^[0-9]{8}@go\.buu\.ac\.th$/;
const DEFAULT_ROLE = 'member';
const SALT_ROUNDS = 10;
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; 
const PASSWORD_MIN_LETTERS = 3; 

// ฟังก์ชันตรวจสอบรูปแบบอีเมลมหาลัย
function validateUniversityEmail(email) {
  return EMAIL_PATTERN.test(email);
}

// ฟังก์ชันตรวจสอบความตรงกันของรหัสนิสิตกับอีเมล
function validateStudentIdEmailMatch(email, studentId) {
  const emailStudentId = email.split('@')[0];
  return emailStudentId === studentId;
}

// ฟังก์ชันตรวจสอบข้อมูลที่ซ้ำกัน
async function checkDuplicateData(field, value, fieldName) {
  const [existing] = await db.query(
    `SELECT id FROM users WHERE ${field} = ?`,
    [value]
  );
  
  if (existing.length > 0) {
    throw new Error(`${fieldName}นี้ถูกใช้งานแล้ว`);
  }
}

// ฟังก์ชันสร้างผู้ใช้ใหม่
async function createUser(userData) {
  const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);
  
  await db.query(
    `INSERT INTO users 
      (student_id, username, email, password, phone, f_name, l_name, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userData.student_id,
      userData.username,
      userData.email,
      hashedPassword,
      userData.phone,
      userData.f_name,
      userData.l_name,
      DEFAULT_ROLE
    ]
  );
}

// หน้าเข้าสู่ระบบ
router.get('/login', (req, res) => {
  res.render('auth/login', { error: null });
});

// จัดการการเข้าสู่ระบบ
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // ตรวจสอบความยาวเบื้องต้น
    if (!username || username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
      return res.render('auth/login', { error: `ชื่อผู้ใช้ต้องมีความยาว ${USERNAME_MIN}-${USERNAME_MAX} ตัวอักษร` });
    }
    if (!password || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      return res.render('auth/login', { error: `รหัสผ่านต้องมีความยาว ${PASSWORD_MIN}-${PASSWORD_MAX} ตัวอักษร` });
    }

    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    
    if (users.length === 0) {
      return res.render('auth/login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
    
    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.render('auth/login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    req.session.user = user;
    res.redirect('/index');
  } catch (error) {
    console.error('ข้อผิดพลาดในการล็อกอิน:', error);
    res.render('auth/login', { error: 'เกิดข้อผิดพลาดในการล็อกอิน' });
  }
});

// หน้าสมัครสมาชิก
router.get('/register', (req, res) => {
  res.render('auth/register', { error: null });
});

// API สำหรับตรวจสอบอีเมล
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'กรุณาระบุอีเมล' });
    }

    // ตรวจสอบรูปแบบอีเมลมหาลัย
    if (!validateUniversityEmail(email)) {
      return res.json({ 
        exists: false, 
        valid: false,
        message: 'รูปแบบอีเมลไม่ถูกต้อง' 
      });
    }

    // ตรวจสอบว่าอีเมลนี้ถูกใช้งานแล้วหรือไม่
    const [users] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    return res.json({
      exists: users.length > 0,
      valid: true,
      message: users.length > 0 ? 'อีเมลนี้ถูกใช้งานแล้ว' : 'อีเมลสามารถใช้งานได้'
    });

  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบ' });
  }
});

// จัดการการสมัครสมาชิก
router.post('/register', async (req, res) => {
  const { student_id, username, email, password, phone, f_name, l_name } = req.body;
  
  try {
    // ตรวจสอบความยาว username/password
    if (!username || username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
      return res.render('auth/register', { 
        error: `ชื่อผู้ใช้ต้องมีความยาว ${USERNAME_MIN}-${USERNAME_MAX} ตัวอักษร`
      });
    }
    if (!password || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      return res.render('auth/register', { 
        error: `รหัสผ่านต้องมีความยาว ${PASSWORD_MIN}-${PASSWORD_MAX} ตัวอักษร`
      });
    }

    // ต้องมีตัวอักษร (a-z หรือ A-Z) อย่างน้อย 3 ตัว
    const letterMatches = (password.match(/[A-Za-z]/g) || []).length;
    if (letterMatches < PASSWORD_MIN_LETTERS) {
      return res.render('auth/register', {
        error: `รหัสผ่านต้องมีตัวอักษรอย่างน้อย ${PASSWORD_MIN_LETTERS} ตัว`
      });
    }

    // ตรวจสอบรูปแบบอีเมลมหาลัย
    if (!validateUniversityEmail(email)) {
      return res.render('auth/register', { 
        error: 'กรุณากรอกอีเมลมหาลัยในรูปแบบ 65160000@go.buu.ac.th' 
      });
    }

    // ตรวจสอบความตรงกันของรหัสนิสิตกับอีเมล
    if (!validateStudentIdEmailMatch(email, student_id)) {
      return res.render('auth/register', { 
        error: 'รหัสนิสิตในอีเมลไม่ตรงกับรหัสนิสิตที่กรอก' 
      });
    }

    // ตรวจสอบข้อมูลที่ซ้ำกัน
    await checkDuplicateData('student_id', student_id, 'รหัสนิสิต');
    await checkDuplicateData('email', email, 'อีเมล');
    await checkDuplicateData('username', username, 'ชื่อผู้ใช้');

    // สร้างผู้ใช้ใหม่
    await createUser({
      student_id,
      username,
      email,
      password,
      phone,
      f_name,
      l_name
    });

    res.redirect('/auth/login');
  } catch (error) {
    console.error('ข้อผิดพลาดในการสมัครสมาชิก:', error);
    res.render('auth/register', { 
      error: error.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก' 
    });
  }
});

// ออกจากระบบ
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('ข้อผิดพลาดในการออกจากระบบ:', err);
    res.redirect('/');
  });
});

module.exports = router;
