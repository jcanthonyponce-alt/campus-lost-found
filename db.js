const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const db = new DatabaseSync('lostfound.db');
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS items(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL,
  description TEXT, location TEXT, date TEXT, status TEXT NOT NULL DEFAULT 'Lost',
  photo TEXT, is_archived INTEGER DEFAULT 0, archived_at TEXT, archive_reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS claims(
  id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  claimant_name TEXT NOT NULL, contact_number TEXT NOT NULL, address TEXT NOT NULL,
  id_type TEXT NOT NULL, id_number TEXT NOT NULL, id_photo TEXT NOT NULL, proof_photo TEXT NOT NULL,
  description TEXT, status TEXT DEFAULT 'Pending', admin_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS item_history(
  id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  action TEXT NOT NULL, reason TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS disputes(
  id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  disputant_name TEXT NOT NULL, contact_number TEXT NOT NULL, reason TEXT NOT NULL, evidence_photo TEXT,
  prev_status TEXT, status TEXT DEFAULT 'Open', resolution TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT);
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, display_name TEXT DEFAULT 'Admin');
`);
try { db.exec("ALTER TABLE admins ADD COLUMN display_name TEXT DEFAULT 'Admin'"); } catch (e) { /* column already exists */ }
if (!db.prepare('SELECT 1 FROM admins').get()) {
  const u = process.env.ADMIN_USER || 'admin', p = process.env.ADMIN_PASS || 'admin123';
  db.prepare('INSERT INTO admins(username,password_hash) VALUES(?,?)').run(u, bcrypt.hashSync(p, 10));
  console.log(`Admin account created -> username: ${u}`);
}
module.exports = db;
