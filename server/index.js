const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const APP_PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'al_khair_pharma_system_secret';
const DB_FILE = process.env.DATABASE_PATH || path.join(__dirname, 'data.db');
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbExists = fs.existsSync(DB_FILE);
const db = new sqlite3.Database(DB_FILE);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
async function logActivity(username, action, target) {
  try {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    await run(`INSERT INTO audit_logs (username, action, target, timestamp) VALUES (?, ?, ?, ?)`, [username || 'unknown', action, target, timestamp]);
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
}

// Initial seed data
const SEED_CONFIG = {
  clinicNameAr: "الخير للأدوية والمستلزمات",
  clinicNameEn: "Al-Khair Pharmaceuticals",
  clinicSubtitleAr: "منظومة إدارة المبيعات والمخازن",
  clinicSubtitleEn: "Sales & Inventory Management",
  managerNameAr: "أ. الخير",
  managerNameEn: "Mr. Al-Khair",
  currencyAr: "د.ل",
  currencyEn: "LYD",
  adminPassword: "101010",
  supervisorPassword: "Aali-",
  employeePassword: "alii"
};

const SEED_DOCTORS = [
  { id: 1, name: "بانادول إكسترا (Panadol Extra)", nameEn: "Panadol Extra", specialty: "مسكن وخافض حرارة", specialtyEn: "Analgesic & Antipyretic", status: "available", visits: 182, phone: "Code: P-EX", image: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=150&q=80" },
  { id: 2, name: "أموكسيسيلين 500 ملغ (Amoxicillin)", nameEn: "Amoxicillin 500mg", specialty: "مضاد حيوي واسع الطيف", specialtyEn: "Broad-spectrum Antibiotic", status: "busy", visits: 245, phone: "Code: AMX-5", image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=150&q=80" },
  { id: 3, name: "ليبيتور 20 ملغ (Lipitor)", nameEn: "Lipitor 20mg", specialty: "خافض للكوليسترول والدهنيات", specialtyEn: "Cholesterol Lowering", status: "available", visits: 310, phone: "Code: LPT-2", image: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=150&q=80" },
  { id: 4, name: "شراب برونكوفين للأطفال (Bronchophane)", nameEn: "Bronchophane Syrup", specialty: "موسع للشعب ومذيب للبلغم", specialtyEn: "Cough Syrup", status: "off", visits: 198, phone: "Code: BCP-S", image: "https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=150&q=80" }
];

const SEED_PATIENTS = [
  { id: 101, name: "صيدلية السلام الكبرى", age: 30, gender: "male", phone: "091-7654321", address: "طرابلس، سوق الجمعة", history: "عميل ممتاز، مسحوبات شهرية منتظمة. حد ائتماني 5000 د.ل.", lastVisit: "2026-05-15" },
  { id: 102, name: "صيدلية ابن سينا الحديثة", age: 45, gender: "female", phone: "092-3456789", address: "طرابلس، حي الأندلس", history: "مستندات كاملة، تسوية الحسابات كل 45 يومًا.", lastVisit: "2026-05-20" },
  { id: 103, name: "مستشفى الهضبة (المستودع الطبي)", age: 60, gender: "female", phone: "091-9988776", address: "طرابلس، أبو سليم", history: "مستودع حكومي، الدفع عن طريق صكوك معتمدة.", lastVisit: "2026-05-30" },
  { id: 104, name: "صيدلية الشفاء الجديدة", age: 15, gender: "male", phone: "094-1122334", address: "طرابلس، بن عاشور", history: "عميل جديد للتجربة والتقييم.", lastVisit: "لا يوجد" }
];

const SEED_RECORDS = [
  { patientId: 101, date: "2026-05-15", doctorName: "بانادول إكسترا (Panadol Extra)", note: "طلب 100 علبة مسكن خافض للحرارة، تم التسليم والتأكيد." },
  { patientId: 101, date: "2026-04-10", doctorName: "أموكسيسيلين 500 ملغ (Amoxicillin)", note: "طلب 50 علبة مضاد حيوي، تم الدفع نقداً عند الاستلام." },
  { patientId: 102, date: "2026-05-20", doctorName: "ليبيتور 20 ملغ (Lipitor)", note: "توريد شحنة 80 علبة خافض كوليسترول، قيد الانتظار." },
  { patientId: 103, date: "2026-05-30", doctorName: "أموكسيسيلين 500 ملغ (Amoxicillin)", note: "تسليم دفعة طارئة من المضادات الحيوية (120 علبة)." }
];

const SEED_APPOINTMENTS = [
  { id: 201, patientId: 101, doctorId: 1, date: "2026-05-31", time: "10:30", reason: "طلب توريد 100 علبة بانادول إكسترا لشحنة الربيع", status: "completed", price: 500 },
  { id: 202, patientId: 103, doctorId: 2, date: "2026-05-31", time: "12:00", reason: "دفعة مستعجلة من المضادات الحيوية للمستشفى", status: "confirmed", price: 1200 },
  { id: 203, patientId: 102, doctorId: 3, date: "2026-05-31", time: "13:30", reason: "تأمين مخزون ليبيتور لصيدلية ابن سينا", status: "pending", price: 2400 },
  { id: 204, patientId: 104, doctorId: 4, date: "2026-06-01", time: "09:00", reason: "عينة تجريبية من شراب السعال للأطفال", status: "pending", price: 50 }
];

const SEED_INVOICES = [
  { id: 1001, patientId: 101, date: "2026-05-31", items: [{ desc: "توريد بانادول إكسترا (100 علبة)", price: 500 }, { desc: "خدمة توصيل وشحن مبرد", price: 50 }], total: 550, status: "paid" },
  { id: 1002, patientId: 103, date: "2026-05-31", items: [{ desc: "دفعة أموكسيسيلين 500 ملغ (120 علبة)", price: 1200 }], total: 1200, status: "paid" },
  { id: 1003, patientId: 102, date: "2026-05-31", items: [{ desc: "توريد ليبيتور 20 ملغ (80 علبة)", price: 2400 }], total: 2400, status: "pending" },
  { id: 1004, patientId: 104, date: "2026-05-28", items: [{ desc: "دفعة تجريبية برونكوفين", price: 50 }], total: 50, status: "unpaid" }
];

async function seedDatabase() {
  // Config keys
  for (const [k, v] of Object.entries(SEED_CONFIG)) {
    await run(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?);`, [k, String(v)]);
  }

  // Users
  const roles = ['admin', 'supervisor', 'employee'];
  for (const role of roles) {
    const defaultPassword = SEED_CONFIG[`${role}Password`] || `${role}1234`;
    const hashed = bcrypt.hashSync(defaultPassword, 8);
    await run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?);`, [role, hashed, role]);
  }

  // Force update passwords of default seeded users to match the user's requested settings
  const adminHashed = bcrypt.hashSync("101010", 8);
  await run(`UPDATE users SET password = ? WHERE username = 'admin'`, [adminHashed]);
  const supervisorHashed = bcrypt.hashSync("Aali-", 8);
  await run(`UPDATE users SET password = ? WHERE username = 'supervisor'`, [supervisorHashed]);
  const employeeHashed = bcrypt.hashSync("alii", 8);
  await run(`UPDATE users SET password = ? WHERE username = 'employee'`, [employeeHashed]);

  // Doctors
  for (const doc of SEED_DOCTORS) {
    await run(`INSERT OR IGNORE INTO doctors (id, name, nameEn, specialty, specialtyEn, status, visits, phone, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [doc.id, doc.name, doc.nameEn, doc.specialty, doc.specialtyEn, doc.status, doc.visits, doc.phone, doc.image]);
  }

  // Patients
  for (const pat of SEED_PATIENTS) {
    await run(`INSERT OR IGNORE INTO patients (id, name, age, gender, phone, address, history, lastVisit) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [pat.id, pat.name, pat.age, pat.gender, pat.phone, pat.address, pat.history, pat.lastVisit]);
  }

  // Medical Records
  const recordCount = await all(`SELECT count(*) as count FROM medical_records`);
  if (recordCount[0].count === 0) {
    for (const rec of SEED_RECORDS) {
      await run(`INSERT INTO medical_records (patientId, date, doctorName, note) VALUES (?, ?, ?, ?);`,
        [rec.patientId, rec.date, rec.doctorName, rec.note]);
    }
  }

  // Appointments
  for (const appt of SEED_APPOINTMENTS) {
    await run(`INSERT OR IGNORE INTO appointments (id, patientId, doctorId, date, time, reason, status, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [appt.id, appt.patientId, appt.doctorId, appt.date, appt.time, appt.reason, appt.status, appt.price || 50]);
  }

  // Invoices
  for (const inv of SEED_INVOICES) {
    await run(`INSERT OR IGNORE INTO invoices (id, patientId, date, items, total, status, createdBy, paymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [inv.id, inv.patientId, inv.date, JSON.stringify(inv.items), inv.total, inv.status, 'admin', 'cash']);
  }
}

async function runMigrations() {
  try {
    await run(`ALTER TABLE patients ADD COLUMN createdBy TEXT;`);
  } catch (e) {}
  try {
    await run(`ALTER TABLE medical_records ADD COLUMN createdBy TEXT;`);
  } catch (e) {}
  try {
    await run(`ALTER TABLE appointments ADD COLUMN createdBy TEXT;`);
  } catch (e) {}
  try {
    await run(`ALTER TABLE invoices ADD COLUMN createdBy TEXT;`);
  } catch (e) {}
  try {
    await run(`ALTER TABLE invoices ADD COLUMN paymentMethod TEXT;`);
  } catch (e) {}
  try {
    await run(`ALTER TABLE appointments ADD COLUMN price REAL;`);
  } catch (e) {}
}

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, role TEXT);`);
  await run(`CREATE TABLE IF NOT EXISTS patients (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, gender TEXT, phone TEXT, address TEXT, history TEXT, lastVisit TEXT, createdBy TEXT);`);
  await run(`CREATE TABLE IF NOT EXISTS medical_records (id INTEGER PRIMARY KEY AUTOINCREMENT, patientId INTEGER, date TEXT, doctorName TEXT, note TEXT, createdBy TEXT, FOREIGN KEY (patientId) REFERENCES patients (id) ON DELETE CASCADE);`);
  await run(`CREATE TABLE IF NOT EXISTS doctors (id INTEGER PRIMARY KEY, name TEXT, nameEn TEXT, specialty TEXT, specialtyEn TEXT, status TEXT, visits INTEGER, phone TEXT, image TEXT);`);
  await run(`CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY, patientId INTEGER, doctorId INTEGER, date TEXT, time TEXT, reason TEXT, status TEXT, price REAL, createdBy TEXT, FOREIGN KEY (patientId) REFERENCES patients (id) ON DELETE CASCADE, FOREIGN KEY (doctorId) REFERENCES doctors (id) ON DELETE CASCADE);`);
  await run(`CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY, patientId INTEGER, date TEXT, items TEXT, total REAL, status TEXT, createdBy TEXT, paymentMethod TEXT, FOREIGN KEY (patientId) REFERENCES patients (id) ON DELETE CASCADE);`);
  await run(`CREATE TABLE IF NOT EXISTS config (key TEXT UNIQUE, value TEXT);`);
  await run(`CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, action TEXT, target TEXT, timestamp TEXT);`);

  await runMigrations();
  await seedDatabase();
  console.log('Al-Khair Pharma Database Initialized & Seeded Successfully.');
}

initDb().catch(err => console.error('Database Initialization Error:', err));

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Serve client static files
const clientPath = path.join(__dirname, '..', 'client');
if (fs.existsSync(clientPath)) {
  app.use(express.static(clientPath));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Authentication
app.post('/api/auth/login', async (req, res) => {
  try {
    const { role, password } = req.body;
    if (!role || !password) return res.status(400).json({ error: 'Username (role) and password are required' });

    const rows = await all(`SELECT * FROM users WHERE username = ? OR role = ?`, [role.toLowerCase(), role]);
    
    let authenticatedUser = null;
    for (const user of rows) {
      if (bcrypt.compareSync(password, user.password)) {
        authenticatedUser = user;
        break;
      }
    }

    if (!authenticatedUser) {
      await logActivity(role, 'فشل تسجيل الدخول / Failed Login', 'كلمة مرور خاطئة أو الحساب غير موجود / Incorrect password or user not found');
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: authenticatedUser.id, username: authenticatedUser.username, role: authenticatedUser.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    await logActivity(authenticatedUser.username, 'تسجيل الدخول / Login', `نجح تسجيل الدخول بصلاحية: ${authenticatedUser.role}`);
    res.json({ token, role: authenticatedUser.role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No authorization token provided' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Token format is Bearer <token>' });
  }

  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired authorization token' });
  }
}

// User management APIs (restricted to admin)
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permission denied: Admin only' });
    const users = await all(`SELECT id, username, role FROM users ORDER BY id ASC`);
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permission denied: Admin only' });
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ error: 'Username, password and role are required' });
    const hashed = bcrypt.hashSync(password, 8);
    await run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, [username.toLowerCase(), hashed, role]);
    await logActivity(req.user.username, 'إضافة مستخدم جديد / Create User', `الحساب: ${username.toLowerCase()}، الصلاحية: ${role}`);
    res.json({ success: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/users/:username/password', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permission denied: Admin only' });
    const { password } = req.body;
    const targetUsername = req.params.username.toLowerCase();
    if (!password) return res.status(400).json({ error: 'Password is required' });
    const hashed = bcrypt.hashSync(password, 8);
    await run(`UPDATE users SET password = ? WHERE username = ?`, [hashed, targetUsername]);
    await logActivity(req.user.username, 'تعديل كلمة مرور / Change Password', `تعديل كلمة مرور الحساب: ${targetUsername}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/users/:username', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permission denied: Admin only' });
    const targetUsername = req.params.username.toLowerCase();
    
    if (targetUsername === req.user.username.toLowerCase()) {
      return res.status(400).json({ error: 'Cannot delete your own logged-in account' });
    }
    if (targetUsername === 'admin') {
      return res.status(400).json({ error: 'Cannot delete default admin account' });
    }
    
    await run(`DELETE FROM users WHERE username = ?`, [targetUsername]);
    await logActivity(req.user.username, 'حذف مستخدم / Delete User', `حذف الحساب: ${targetUsername}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Config Endpoints
app.get('/api/config', async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM config`);
    const config = {};
    rows.forEach(r => { config[r.key] = r.value; });
    res.json(config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/config', authMiddleware, async (req, res) => {
  try {
    const configData = req.body;
    for (const [key, value] of Object.entries(configData)) {
      await run(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, [key, String(value)]);
    }
    await logActivity(req.user.username, 'تعديل إعدادات الشركة / Update Config', 'تم حفظ إعدادات العيادة العامة');
    res.json({ message: 'Configuration saved successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/config/passwords', authMiddleware, async (req, res) => {
  try {
    const { adminPassword, staffPassword } = req.body;
    if (adminPassword) {
      const hashed = bcrypt.hashSync(adminPassword, 8);
      await run(`UPDATE users SET password = ? WHERE role = 'admin'`, [hashed]);
      await run(`INSERT OR REPLACE INTO config (key, value) VALUES ('adminPassword', ?)`, [adminPassword]);
    }
    if (staffPassword) {
      const hashed = bcrypt.hashSync(staffPassword, 8);
      await run(`UPDATE users SET password = ? WHERE role = 'supervisor'`, [hashed]);
      await run(`UPDATE users SET password = ? WHERE role = 'employee'`, [hashed]);
      await run(`INSERT OR REPLACE INTO config (key, value) VALUES ('supervisorPassword', ?)`, [staffPassword]);
      await run(`INSERT OR REPLACE INTO config (key, value) VALUES ('employeePassword', ?)`, [staffPassword]);
    }
    await logActivity(req.user.username, 'تعديل كلمات المرور / Update Passwords', 'تحديث كلمات المرور لـ Admin/Staff');
    res.json({ message: 'Passwords updated successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Patients API
app.get('/api/patients', authMiddleware, async (req, res) => {
  try {
    const patients = await all(`SELECT * FROM patients ORDER BY id DESC`);
    for (let patient of patients) {
      patient.records = await all(`SELECT date, doctorName, note FROM medical_records WHERE patientId = ? ORDER BY id DESC`, [patient.id]);
    }
    res.json(patients);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/patients', authMiddleware, async (req, res) => {
  try {
    const { id, name, age, gender, phone, address, history, lastVisit } = req.body;
    const createdBy = req.user ? req.user.username : 'admin';
    await run(`INSERT OR REPLACE INTO patients (id, name, age, gender, phone, address, history, lastVisit, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, age, gender, phone, address, history, lastVisit || 'جديد', createdBy]);
    await logActivity(createdBy, 'حفظ بيانات العميل / Save Customer', `المريض: ${name} (ملف #${id})`);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/patients/:id/records', authMiddleware, async (req, res) => {
  try {
    const patientId = parseInt(req.params.id);
    const { date, doctorName, note } = req.body;
    const createdBy = req.user ? req.user.username : 'admin';
    await run(`INSERT INTO medical_records (patientId, date, doctorName, note, createdBy) VALUES (?, ?, ?, ?, ?)`,
      [patientId, date, doctorName, note, createdBy]);
    await run(`UPDATE patients SET lastVisit = ? WHERE id = ?`, [date, patientId]);
    await logActivity(createdBy, 'إضافة قيد تجاري / Add Trade Record', `إضافة زيارة للملف #${patientId} مع الطبيب ${doctorName}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/patients/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await run(`DELETE FROM patients WHERE id = ?`, [id]);
    await run(`DELETE FROM medical_records WHERE patientId = ?`, [id]);
    await run(`DELETE FROM appointments WHERE patientId = ?`, [id]);
    await run(`DELETE FROM invoices WHERE patientId = ?`, [id]);
    await logActivity(req.user.username, 'حذف العميل / Delete Customer', `حذف المريض صاحب الملف #${id} وكافة سجلاته`);
    res.json({ message: 'Patient deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Doctors API
app.get('/api/doctors', authMiddleware, async (req, res) => {
  try {
    const doctors = await all(`SELECT * FROM doctors ORDER BY id ASC`);
    res.json(doctors);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/doctors', authMiddleware, async (req, res) => {
  try {
    const { id, name, nameEn, specialty, specialtyEn, status, visits, phone, image } = req.body;
    await run(`INSERT OR REPLACE INTO doctors (id, name, nameEn, specialty, specialtyEn, status, visits, phone, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, nameEn, specialty, specialtyEn, status, visits || 0, phone, image]);
    await logActivity(req.user.username, 'حفظ بيانات المنتج / Save Product', `الطبيب: ${name} (معرف #${id})`);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/doctors/:id/status', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    await run(`UPDATE doctors SET status = ? WHERE id = ?`, [status, id]);
    await logActivity(req.user.username, 'تحديث حالة طبيب / Update Doctor Status', `الطبيب معرف #${id} إلى الحالة: ${status}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/doctors/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await run(`DELETE FROM doctors WHERE id = ?`, [id]);
    await run(`DELETE FROM appointments WHERE doctorId = ?`, [id]);
    await logActivity(req.user.username, 'حذف المنتج / Delete Product', `حذف الطبيب معرف #${id}`);
    res.json({ message: 'Doctor deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Appointments API
app.get('/api/appointments', authMiddleware, async (req, res) => {
  try {
    const appointments = await all(`SELECT * FROM appointments ORDER BY date DESC, time DESC`);
    res.json(appointments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/appointments', authMiddleware, async (req, res) => {
  try {
    const { id, patientId, doctorId, date, time, reason, status, price } = req.body;
    const createdBy = req.user ? req.user.username : 'admin';
    await run(`INSERT OR REPLACE INTO appointments (id, patientId, doctorId, date, time, reason, status, price, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, patientId, doctorId, date, time, reason, status || 'pending', price !== undefined ? price : null, createdBy]);
    await logActivity(createdBy, 'حجز/تعديل طلبية / Save Order', `موعد #${id} للمريض #${patientId} مع الطبيب #${doctorId}`);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/appointments/:id/status', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    await run(`UPDATE appointments SET status = ? WHERE id = ?`, [status, id]);

    if (status === 'completed') {
      // Increment doctor visits count
      await run(`UPDATE doctors SET visits = visits + 1 WHERE id = (SELECT doctorId FROM appointments WHERE id = ?)`, [id]);
    }
    await logActivity(req.user.username, 'تحديث حالة موعد / Update Appointment Status', `تغيير حالة الموعد #${id} إلى: ${status}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/appointments/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await run(`DELETE FROM appointments WHERE id = ?`, [id]);
    await logActivity(req.user.username, 'إلغاء/حذف طلبية / Delete Order', `حذف الموعد #${id}`);
    res.json({ message: 'Appointment deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Invoices API
app.get('/api/invoices', authMiddleware, async (req, res) => {
  try {
    const invoices = await all(`SELECT * FROM invoices ORDER BY id DESC`);
    invoices.forEach(inv => {
      try {
        inv.items = JSON.parse(inv.items);
      } catch (err) {
        inv.items = [];
      }
    });
    res.json(invoices);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/invoices', authMiddleware, async (req, res) => {
  try {
    const { id, patientId, date, items, total, status, paymentMethod } = req.body;
    const createdBy = req.user ? req.user.username : 'admin';
    await run(`INSERT OR REPLACE INTO invoices (id, patientId, date, items, total, status, createdBy, paymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, patientId, date, JSON.stringify(items), total, status, createdBy, paymentMethod || 'cash']);
    await logActivity(createdBy, 'إصدار فاتورة / Issue Invoice', `فاتورة #${id} للمريض #${patientId} بقيمة ${total} د.ل (الدفع: ${paymentMethod || 'cash'})`);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/invoices/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
      return res.status(403).json({ error: 'Permission denied: Admin or Supervisor only' });
    }
    const id = parseInt(req.params.id);
    const { status, paymentMethod } = req.body;

    const currentRows = await all(`SELECT * FROM invoices WHERE id = ?`, [id]);
    const currentInvoice = currentRows[0];
    if (!currentInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    let updateFields = [];
    let params = [];
    let activityLogDetails = [];

    if (status !== undefined) {
      updateFields.push('status = ?');
      params.push(status);
      activityLogDetails.push(`حالة الفاتورة من "${currentInvoice.status}" إلى "${status}"`);
    }

    if (paymentMethod !== undefined) {
      updateFields.push('paymentMethod = ?');
      params.push(paymentMethod);
      activityLogDetails.push(`طريقة الدفع من "${currentInvoice.paymentMethod || 'cash'}" إلى "${paymentMethod}"`);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    await run(`UPDATE invoices SET ${updateFields.join(', ')} WHERE id = ?`, params);
    
    await logActivity(
      req.user.username,
      'تعديل الفاتورة / Update Invoice',
      `فاتورة #${id} - تعديل: ${activityLogDetails.join('، ')}`
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/invoices/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await run(`DELETE FROM invoices WHERE id = ?`, [id]);
    await logActivity(req.user.username, 'حذف فاتورة / Delete Invoice', `حذف الفاتورة #${id}`);
    res.json({ message: 'Invoice deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DB Backup Reset / Import / Export
app.post('/api/reset', authMiddleware, async (req, res) => {
  try {
    await run(`DELETE FROM users;`);
    await run(`DELETE FROM patients;`);
    await run(`DELETE FROM medical_records;`);
    await run(`DELETE FROM doctors;`);
    await run(`DELETE FROM appointments;`);
    await run(`DELETE FROM invoices;`);
    await run(`DELETE FROM config;`);
    await run(`DELETE FROM audit_logs;`);
    
    await seedDatabase();
    await logActivity(req.user.username, 'تصفير قاعدة البيانات / Database Reset', 'إعادة ضبط المنظومة للقيم الافتراضية');
    res.json({ success: true, message: 'Database reset to defaults successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/import', authMiddleware, async (req, res) => {
  try {
    const data = req.body;
    if (!data.patients || !data.doctors || !data.appointments || !data.invoices || !data.config) {
      return res.status(400).json({ error: 'Invalid database backup structure' });
    }

    // Clear all
    await run(`DELETE FROM patients;`);
    await run(`DELETE FROM medical_records;`);
    await run(`DELETE FROM doctors;`);
    await run(`DELETE FROM appointments;`);
    await run(`DELETE FROM invoices;`);
    await run(`DELETE FROM config;`);
    await run(`DELETE FROM audit_logs;`);

    // Import patients & records
    for (const pat of data.patients) {
      await run(`INSERT OR REPLACE INTO patients (id, name, age, gender, phone, address, history, lastVisit, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pat.id, pat.name, pat.age, pat.gender, pat.phone, pat.address, pat.history, pat.lastVisit, pat.createdBy || 'admin']);
      if (pat.records && Array.isArray(pat.records)) {
        for (const rec of pat.records) {
          await run(`INSERT INTO medical_records (patientId, date, doctorName, note, createdBy) VALUES (?, ?, ?, ?, ?)`,
            [pat.id, rec.date, rec.doctorName, rec.note, rec.createdBy || 'admin']);
        }
      }
    }

    // Import doctors
    for (const doc of data.doctors) {
      await run(`INSERT OR REPLACE INTO doctors (id, name, nameEn, specialty, specialtyEn, status, visits, phone, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [doc.id, doc.name, doc.nameEn, doc.specialty, doc.specialtyEn, doc.status, doc.visits, doc.phone, doc.image]);
    }

    // Import appointments
    for (const appt of data.appointments) {
      await run(`INSERT OR REPLACE INTO appointments (id, patientId, doctorId, date, time, reason, status, price, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [appt.id, appt.patientId, appt.doctorId, appt.date, appt.time, appt.reason, appt.status, appt.price || null, appt.createdBy || 'admin']);
    }

    // Import invoices
    for (const inv of data.invoices) {
      await run(`INSERT OR REPLACE INTO invoices (id, patientId, date, items, total, status, createdBy, paymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [inv.id, inv.patientId, inv.date, JSON.stringify(inv.items), inv.total, inv.status, inv.createdBy || 'admin', inv.paymentMethod || 'cash']);
    }

    // Import config
    for (const [k, v] of Object.entries(data.config)) {
      await run(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, [k, String(v)]);
      
      // Sync passwords in users table if config contains them
      if (k === 'adminPassword') {
        const hashed = bcrypt.hashSync(String(v), 8);
        await run(`UPDATE users SET password = ? WHERE role = 'admin'`, [hashed]);
      } else if (k === 'supervisorPassword') {
        const hashed = bcrypt.hashSync(String(v), 8);
        await run(`UPDATE users SET password = ? WHERE role = 'supervisor'`, [hashed]);
      } else if (k === 'employeePassword') {
        const hashed = bcrypt.hashSync(String(v), 8);
        await run(`UPDATE users SET password = ? WHERE role = 'employee'`, [hashed]);
      }
    }

    await logActivity(req.user.username, 'استيراد قاعدة البيانات / Import Database', 'استيراد نسخة احتياطية من ملف خارجي بنجاح');
    res.json({ success: true, message: 'Database imported successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Audit Logs APIs (restricted to admin)
app.get('/api/audit-logs', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permission denied: Admin only' });
    const logs = await all(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500`);
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/audit-logs', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permission denied: Admin only' });
    await run(`DELETE FROM audit_logs`);
    await logActivity(req.user.username, 'مسح سجل النشاطات / Clear Audit Logs', 'تم مسح السجل التاريخي بالكامل');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// ==========================================
// DEVELOPER BACKDOOR APIs
// ==========================================
const DEVELOPER_KEY = process.env.DEVELOPER_KEY || 'VegsoX-';

function developerAuthMiddleware(req, res, next) {
  const devKey = req.headers['x-developer-key'];
  if (!devKey || devKey !== DEVELOPER_KEY) {
    return res.status(403).json({ error: 'Unauthorized: Invalid developer key' });
  }
  next();
}

app.post('/api/developer/auth', (req, res) => {
  const { key } = req.body;
  if (key === DEVELOPER_KEY) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Developer key is incorrect' });
  }
});

app.post('/api/developer/sql', developerAuthMiddleware, async (req, res) => {
  const { query, params } = req.body;
  if (!query) return res.status(400).json({ error: 'SQL query is required' });
  try {
    const cleanQuery = query.trim();
    const isSelect = cleanQuery.toUpperCase().startsWith('SELECT') || cleanQuery.toUpperCase().startsWith('PRAGMA');
    if (isSelect) {
      const rows = await all(cleanQuery, params || []);
      res.json({ success: true, type: 'select', data: rows });
    } else {
      const result = await run(cleanQuery, params || []);
      res.json({ success: true, type: 'write', changes: result.changes, lastID: result.lastID });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/developer/tables', developerAuthMiddleware, async (req, res) => {
  try {
    const tables = await all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tableDetails = [];
    for (let t of tables) {
      const info = await all(`PRAGMA table_info(${t.name})`);
      tableDetails.push({ name: t.name, columns: info.map(c => `${c.name} (${c.type})`) });
    }
    res.json({ success: true, tables: tableDetails });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/developer/diagnostics', developerAuthMiddleware, (req, res) => {
  res.json({
    success: true,
    uptime: Math.floor(process.uptime()),
    memory: process.memoryUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    arch: process.arch,
    dbFile: DB_FILE
  });
});

app.post('/api/developer/user/create', developerAuthMiddleware, async (req, res) => {
  const { username, role, password } = req.body;
  if (!username || !role || !password) {
    return res.status(400).json({ error: 'Username, role, and password are required' });
  }
  try {
    const hashed = bcrypt.hashSync(password, 8);
    await run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, [username.toLowerCase(), hashed, role]);
    await logActivity('developer', 'إضافة مستخدم عبر المطور / Dev User Create', `الحساب: ${username.toLowerCase()}، الصلاحية: ${role}`);
    res.json({ success: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/developer/user/password', developerAuthMiddleware, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    const hashed = bcrypt.hashSync(password, 8);
    await run(`UPDATE users SET password = ? WHERE username = ?`, [hashed, username.toLowerCase()]);
    await logActivity('developer', 'تعديل كلمة مرور عبر المطور / Dev Change Password', `تعديل كلمة مرور الحساب: ${username.toLowerCase()}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// developer-only database backup/export
app.get('/api/developer/export', developerAuthMiddleware, async (req, res) => {
  try {
    const patients = await all(`SELECT * FROM patients ORDER BY id DESC`);
    for (let patient of patients) {
      patient.records = await all(`SELECT date, doctorName, note FROM medical_records WHERE patientId = ? ORDER BY id DESC`, [patient.id]);
    }
    const doctors = await all(`SELECT * FROM doctors ORDER BY id ASC`);
    const appointments = await all(`SELECT * FROM appointments ORDER BY date DESC, time DESC`);
    const invoices = await all(`SELECT * FROM invoices ORDER BY id DESC`);
    invoices.forEach(inv => {
      try {
        inv.items = JSON.parse(inv.items);
      } catch (err) {
        inv.items = [];
      }
    });
    const configRows = await all(`SELECT * FROM config`);
    const config = {};
    configRows.forEach(r => { config[r.key] = r.value; });

    res.json({
      success: true,
      patients,
      doctors,
      appointments,
      invoices,
      config
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// developer-only database restore/import
app.post('/api/developer/import', developerAuthMiddleware, async (req, res) => {
  try {
    const data = req.body;
    if (!data.patients || !data.doctors || !data.appointments || !data.invoices || !data.config) {
      return res.status(400).json({ error: 'Invalid database backup structure' });
    }

    // Clear all
    await run(`DELETE FROM patients;`);
    await run(`DELETE FROM medical_records;`);
    await run(`DELETE FROM doctors;`);
    await run(`DELETE FROM appointments;`);
    await run(`DELETE FROM invoices;`);
    await run(`DELETE FROM config;`);
    await run(`DELETE FROM audit_logs;`);

    // Import patients & records
    for (const pat of data.patients) {
      await run(`INSERT OR REPLACE INTO patients (id, name, age, gender, phone, address, history, lastVisit, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pat.id, pat.name, pat.age, pat.gender, pat.phone, pat.address, pat.history, pat.lastVisit, pat.createdBy || 'admin']);
      if (pat.records && Array.isArray(pat.records)) {
        for (const rec of pat.records) {
          await run(`INSERT INTO medical_records (patientId, date, doctorName, note, createdBy) VALUES (?, ?, ?, ?, ?)`,
            [pat.id, rec.date, rec.doctorName, rec.note, rec.createdBy || 'admin']);
        }
      }
    }

    // Import doctors
    for (const doc of data.doctors) {
      await run(`INSERT OR REPLACE INTO doctors (id, name, nameEn, specialty, specialtyEn, status, visits, phone, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [doc.id, doc.name, doc.nameEn, doc.specialty, doc.specialtyEn, doc.status, doc.visits, doc.phone, doc.image]);
    }

    // Import appointments
    for (const appt of data.appointments) {
      await run(`INSERT OR REPLACE INTO appointments (id, patientId, doctorId, date, time, reason, status, price, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [appt.id, appt.patientId, appt.doctorId, appt.date, appt.time, appt.reason, appt.status, appt.price || null, appt.createdBy || 'admin']);
    }

    // Import invoices
    for (const inv of data.invoices) {
      await run(`INSERT OR REPLACE INTO invoices (id, patientId, date, items, total, status, createdBy, paymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [inv.id, inv.patientId, inv.date, JSON.stringify(inv.items), inv.total, inv.status, inv.createdBy || 'admin', inv.paymentMethod || 'cash']);
    }

    // Import config
    for (const [k, v] of Object.entries(data.config)) {
      await run(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, [k, String(v)]);
      
      // Sync passwords in users table if config contains them
      if (k === 'adminPassword') {
        const hashed = bcrypt.hashSync(String(v), 8);
        await run(`UPDATE users SET password = ? WHERE role = 'admin'`, [hashed]);
      } else if (k === 'supervisorPassword') {
        const hashed = bcrypt.hashSync(String(v), 8);
        await run(`UPDATE users SET password = ? WHERE role = 'supervisor'`, [hashed]);
      } else if (k === 'employeePassword') {
        const hashed = bcrypt.hashSync(String(v), 8);
        await run(`UPDATE users SET password = ? WHERE role = 'employee'`, [hashed]);
      }
    }

    await logActivity('developer', 'استيراد قاعدة البيانات عبر المطور / Dev Import Database', 'استيراد نسخة احتياطية من ملف خارجي بنجاح');
    res.json({ success: true, message: 'Database imported successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// developer-only database reset
app.post('/api/developer/reset', developerAuthMiddleware, async (req, res) => {
  try {
    await run(`DELETE FROM users;`);
    await run(`DELETE FROM patients;`);
    await run(`DELETE FROM medical_records;`);
    await run(`DELETE FROM doctors;`);
    await run(`DELETE FROM appointments;`);
    await run(`DELETE FROM invoices;`);
    await run(`DELETE FROM config;`);
    await run(`DELETE FROM audit_logs;`);
    
    await seedDatabase();
    await logActivity('developer', 'تصفير قاعدة البيانات عبر المطور / Dev Database Reset', 'إعادة ضبط المنظومة للقيم الافتراضية');
    res.json({ success: true, message: 'Database reset to defaults successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Fallback - serve client index if using browser routes
app.get('*', (req, res) => {
  if (fs.existsSync(path.join(clientPath, 'index.html'))) {
    res.sendFile(path.join(clientPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.listen(APP_PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${APP_PORT}`);
});
