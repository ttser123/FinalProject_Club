// ตรวจสอบว่าผู้ใช้ล็อกอินหรือไม่ (middleware)
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/');
}

// เช็คสิทธิ์บทบาท
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(403).send('Forbidden: Admins only');
}

function isLeader(req, res, next) {
  if (req.session.user && req.session.user.role === 'leader') {
    return next();
  }
  return res.status(403).send('Forbidden: Leaders only');
}

function ensureAdmin(req, res, next) {
  return isAdmin(req, res, next);
}

function ensureAdminOrLeader(req, res, next) {
  if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'leader')) {
    return next();
  }
  return res.status(403).send('Forbidden: Admins or Leaders only');
}

function ensureAdminOrClubLeader(req, res, next) {
  return ensureAdminOrLeader(req, res, next);
}

module.exports = {
  isAuthenticated,
  isAdmin,
  isLeader,
  ensureAdmin,
  ensureAdminOrLeader,
  ensureAdminOrClubLeader
}; 