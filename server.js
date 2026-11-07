const express = require('express'), session = require('express-session'), multer = require('multer');
const bcrypt = require('bcryptjs'), path = require('path'), fs = require('fs');
const db = require('./db');
const app = express();
const PUB = path.join(__dirname, 'uploads/items'), PRIV = path.join(__dirname, 'uploads/private');
[PUB, PRIV].forEach(d => fs.mkdirSync(d, { recursive: true }));

const upload = multer({
  storage: multer.diskStorage({
    destination: (r, f, cb) => cb(null, f.fieldname === 'photo' ? PUB : PRIV),
    filename: (r, f, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(f.originalname).toLowerCase())
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (r, f, cb) => cb(null, /^image\//.test(f.mimetype))
});

app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET || 'change-me-in-production', resave: false, saveUninitialized: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads/items', express.static(PUB));

const admin = (req, res, next) => req.session.admin ? next() : res.status(401).json({ error: 'Admin login required' });
const log = (id, action, reason) => db.prepare('INSERT INTO item_history(item_id,action,reason) VALUES(?,?,?)').run(id, action, reason || '');
const settle = id => {
  const q = st => db.prepare('SELECT COUNT(*) n FROM claims WHERE item_id=? AND status=?').get(id, st).n;
  const n = q('Pending'), ap = q('Approved');
  const od = db.prepare("SELECT COUNT(*) n FROM disputes WHERE item_id=? AND status='Open'").get(id).n;
  db.prepare('UPDATE items SET status=? WHERE id=?').run(od ? 'Disputed' : n ? (n > 1 || ap ? 'Disputed' : 'Pending Claim') : (ap ? 'Claimed' : 'Found'), id);
};
const need = (res, obj, keys) => { const m = keys.filter(k => !String(obj[k] || '').trim()); if (m.length) { res.status(400).json({ error: 'Missing: ' + m.join(', ') }); return false; } return true; };

// ---- Auth ----
app.post('/api/login', (req, res) => {
  const a = db.prepare('SELECT * FROM admins WHERE username=?').get(req.body.username || '');
  if (!a || !bcrypt.compareSync(req.body.password || '', a.password_hash)) return res.status(401).json({ error: 'Wrong username or password' });
  req.session.admin = true; req.session.adminId = a.id; res.json({ ok: true });
});
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
const meRow = req => db.prepare('SELECT * FROM admins WHERE id=?').get(req.session.adminId || 0) || db.prepare('SELECT * FROM admins ORDER BY id LIMIT 1').get();
app.get('/api/me', (req, res) => {
  if (!req.session.admin) return res.json({ admin: false });
  const a = meRow(req); res.json({ admin: true, name: a.display_name || 'Admin', username: a.username });
});
app.put('/api/profile', admin, (req, res) => {
  const a = meRow(req), b = req.body;
  if (!bcrypt.compareSync(b.current_password || '', a.password_hash)) return res.status(400).json({ error: 'Current password is wrong' });
  if (!need(res, b, ['display_name', 'username'])) return;
  if (b.new_password && b.new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  try {
    db.prepare('UPDATE admins SET display_name=?, username=?, password_hash=? WHERE id=?')
      .run(b.display_name.trim(), b.username.trim(), b.new_password ? bcrypt.hashSync(b.new_password, 10) : a.password_hash, a.id);
  } catch (e) { return res.status(400).json({ error: 'That username is already taken' }); }
  res.json({ ok: true });
});

// ---- Items ----
app.get('/api/stats', (req, res) => {
  const s = { Lost: 0, Found: 0, 'Pending Claim': 0, Disputed: 0, Claimed: 0, Returned: 0 };
  db.prepare('SELECT status, COUNT(*) n FROM items WHERE is_archived=0 GROUP BY status').all().forEach(r => s[r.status] = r.n);
  s.Archived = db.prepare('SELECT COUNT(*) n FROM items WHERE is_archived=1').get().n;
  s.PendingClaims = db.prepare("SELECT COUNT(*) n FROM claims WHERE status='Pending'").get().n;
  s.OpenDisputes = db.prepare("SELECT COUNT(*) n FROM disputes WHERE status='Open'").get().n;
  res.json(s);
});

app.get('/api/items', (req, res) => {
  const arch = req.query.archived === '1';
  if (arch && !req.session.admin) return res.status(401).json({ error: 'Admin login required' });
  const { q = '', status = '', category = '' } = req.query;
  res.json(db.prepare(`SELECT i.*, (SELECT COUNT(*) FROM claims c WHERE c.item_id=i.id AND c.status='Pending') pending
    FROM items i WHERE is_archived=@a AND (name LIKE @q OR description LIKE @q OR location LIKE @q)
    AND (@s='' OR status=@s) AND (@c='' OR category=@c) ORDER BY id DESC`)
    .all({ a: arch ? 1 : 0, q: `%${q}%`, s: status, c: category }));
});

app.get('/api/items/:id(\\d+)', (req, res) => {
  const it = db.prepare('SELECT * FROM items WHERE id=?').get(req.params.id);
  if (!it || (it.is_archived && !req.session.admin)) return res.status(404).json({ error: 'Item not found' });
  res.json(it);
});

app.post('/api/items', upload.single('photo'), (req, res) => {
  const b = req.body; if (!need(res, b, ['name', 'category', 'location', 'date'])) return;
  const status = b.status === 'Found' ? 'Found' : 'Lost';
  const r = db.prepare('INSERT INTO items(name,category,description,location,date,status,photo) VALUES(?,?,?,?,?,?,?)')
    .run(b.name, b.category, b.description, b.location, b.date, status, req.file ? req.file.filename : null);
  log(r.lastInsertRowid, 'created', `Reported as ${status}`);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/items/:id', admin, upload.single('photo'), (req, res) => {
  const b = req.body, it = db.prepare('SELECT * FROM items WHERE id=?').get(req.params.id);
  if (!it) return res.status(404).json({ error: 'Item not found' });
  if (!need(res, b, ['name', 'category', 'location', 'date', 'status'])) return;
  db.prepare('UPDATE items SET name=?,category=?,description=?,location=?,date=?,status=?,photo=? WHERE id=?')
    .run(b.name, b.category, b.description, b.location, b.date, b.status, req.file ? req.file.filename : it.photo, it.id);
  log(it.id, 'edited', it.status !== b.status ? `Status ${it.status} -> ${b.status}` : 'Details updated');
  res.json({ ok: true });
});

app.post('/api/items/:id/archive', admin, (req, res) => {
  if (!need(res, req.body, ['reason'])) return;
  const it = db.prepare('SELECT * FROM items WHERE id=?').get(req.params.id);
  db.prepare("UPDATE items SET is_archived=1, archived_at=datetime('now'), archive_reason=? WHERE id=?").run(req.body.reason, it.id);
  log(it.id, 'archived', `${req.body.reason} (status was ${it.status})`); res.json({ ok: true });
});

app.post('/api/items/:id/restore', admin, (req, res) => {
  if (!need(res, req.body, ['reason'])) return;
  db.prepare('UPDATE items SET is_archived=0, archived_at=NULL, archive_reason=NULL WHERE id=?').run(req.params.id);
  log(req.params.id, 'restored', req.body.reason); res.json({ ok: true });
});

app.delete('/api/items/:id', admin, (req, res) => {
  const it = db.prepare('SELECT * FROM items WHERE id=?').get(req.params.id);
  if (!it || !it.is_archived) return res.status(400).json({ error: 'Only archived items can be permanently deleted' });
  db.prepare('SELECT id_photo, proof_photo FROM claims WHERE item_id=?').all(it.id)
    .forEach(c => [c.id_photo, c.proof_photo].forEach(f => fs.rmSync(path.join(PRIV, f), { force: true })));
  db.prepare('SELECT evidence_photo FROM disputes WHERE item_id=?').all(it.id).forEach(x => x.evidence_photo && fs.rmSync(path.join(PRIV, x.evidence_photo), { force: true }));
  if (it.photo) fs.rmSync(path.join(PUB, it.photo), { force: true });
  db.prepare('DELETE FROM items WHERE id=?').run(it.id); res.json({ ok: true });
});

app.get('/api/items/:id/history', admin, (req, res) =>
  res.json(db.prepare('SELECT * FROM item_history WHERE item_id=? ORDER BY id DESC').all(req.params.id)));

// ---- Dashboard feeds ----
app.get('/api/activity', (req, res) => res.json(db.prepare(
  `SELECT h.action, h.reason, h.created_at, i.name item_name FROM item_history h JOIN items i ON i.id=h.item_id
   ${req.session.admin ? '' : "WHERE h.action='created'"} ORDER BY h.id DESC LIMIT 6`).all()));

// ---- Claims ----
app.post('/api/items/:id/claims', upload.fields([{ name: 'id_photo', maxCount: 1 }, { name: 'proof_photo', maxCount: 1 }]), (req, res) => {
  const b = req.body, it = db.prepare('SELECT * FROM items WHERE id=? AND is_archived=0').get(req.params.id);
  if (!it) return res.status(404).json({ error: 'Item not found' });
  if (!['Found', 'Pending Claim', 'Disputed', 'Claimed'].includes(it.status)) return res.status(400).json({ error: 'This item cannot be claimed right now' });
  if (!need(res, b, ['claimant_name', 'contact_number', 'address', 'id_type', 'id_number', 'description'])) return;
  if (!req.files.id_photo || !req.files.proof_photo) return res.status(400).json({ error: 'ID photo and proof photo are required (images only, max 5 MB)' });
  db.prepare(`INSERT INTO claims(item_id,claimant_name,contact_number,address,id_type,id_number,id_photo,proof_photo,description)
    VALUES(?,?,?,?,?,?,?,?,?)`).run(it.id, b.claimant_name, b.contact_number, b.address, b.id_type, b.id_number,
    req.files.id_photo[0].filename, req.files.proof_photo[0].filename, b.description);
  settle(it.id);
  const n = db.prepare("SELECT COUNT(*) n FROM claims WHERE item_id=? AND status='Pending'").get(it.id).n;
  log(it.id, 'claim submitted', `By ${b.claimant_name}` + (it.status === 'Claimed' ? ' - item was already approved to another claimant' : n > 1 ? ` - ${n} competing claims` : ''));
  res.json({ ok: true });
});

app.get('/api/claims', admin, (req, res) => res.json(db.prepare(
  `SELECT c.*, i.name item_name FROM claims c JOIN items i ON i.id=c.item_id
   WHERE (@i='' OR c.item_id=@i) ORDER BY (c.status='Pending') DESC, c.id DESC`).all({ i: req.query.item_id || '' })));

app.post('/api/claims/:id/decision', admin, (req, res) => {
  const { decision, notes } = req.body, c = db.prepare('SELECT * FROM claims WHERE id=?').get(req.params.id);
  if (!c || c.status !== 'Pending' || !['Approved', 'Rejected'].includes(decision)) return res.status(400).json({ error: 'Invalid decision' });
  if (decision === 'Rejected' && !String(notes || '').trim()) return res.status(400).json({ error: 'Give a reason for rejecting' });
  db.prepare('UPDATE claims SET status=?, admin_notes=? WHERE id=?').run(decision, notes || '', c.id);
  if (decision === 'Approved') {
    db.prepare("UPDATE claims SET status='Rejected', admin_notes='Another claim was approved' WHERE item_id=? AND status='Pending'").run(c.item_id);
    db.prepare("UPDATE claims SET status='Rejected', admin_notes='Replaced by a later approved claim' WHERE item_id=? AND status='Approved' AND id<>?").run(c.item_id, c.id);
    settle(c.item_id);
  } else settle(c.item_id);
  log(c.item_id, `claim ${decision.toLowerCase()}`, `${c.claimant_name}${notes ? ': ' + notes : ''}`);
  res.json({ ok: true });
});

// ---- Disputes ----
app.post('/api/items/:id/disputes', upload.single('evidence_photo'), (req, res) => {
  const b = req.body, it = db.prepare('SELECT * FROM items WHERE id=? AND is_archived=0').get(req.params.id);
  if (!it) return res.status(404).json({ error: 'Item not found' });
  if (!['Pending Claim', 'Disputed', 'Claimed', 'Returned'].includes(it.status)) return res.status(400).json({ error: 'Only items that already have a claim can be disputed' });
  if (!need(res, b, ['disputant_name', 'contact_number', 'reason'])) return;
  const prev = it.status === 'Disputed'
    ? ((db.prepare("SELECT prev_status FROM disputes WHERE item_id=? AND status='Open' ORDER BY id LIMIT 1").get(it.id) || {}).prev_status || 'Disputed') : it.status;
  db.prepare('INSERT INTO disputes(item_id,disputant_name,contact_number,reason,evidence_photo,prev_status) VALUES(?,?,?,?,?,?)')
    .run(it.id, b.disputant_name, b.contact_number, b.reason, req.file ? req.file.filename : null, prev);
  settle(it.id);
  log(it.id, 'dispute filed', `By ${b.disputant_name}: ${b.reason}`);
  res.json({ ok: true });
});

app.get('/api/disputes', admin, (req, res) => res.json(db.prepare(
  `SELECT d.*, i.name item_name FROM disputes d JOIN items i ON i.id=d.item_id WHERE (@i='' OR d.item_id=@i)
   ORDER BY (d.status='Open') DESC, d.id DESC`).all({ i: req.query.item_id || '' })));

app.post('/api/disputes/:id/resolve', admin, (req, res) => {
  const { outcome, notes } = req.body, d = db.prepare('SELECT * FROM disputes WHERE id=?').get(req.params.id);
  if (!d || d.status !== 'Open' || !['dismiss', 'uphold'].includes(outcome)) return res.status(400).json({ error: 'Invalid request' });
  if (!String(notes || '').trim()) return res.status(400).json({ error: 'Add resolution notes' });
  const label = outcome === 'uphold' ? 'Upheld' : 'Dismissed';
  db.prepare("UPDATE disputes SET status=?, resolution=?, resolved_at=datetime('now') WHERE id=?").run(label, notes, d.id);
  if (outcome === 'uphold') db.prepare("UPDATE claims SET status='Rejected', admin_notes=? WHERE item_id=? AND status='Approved'").run('Dispute upheld: ' + notes, d.item_id);
  settle(d.item_id);
  const od = db.prepare("SELECT COUNT(*) n FROM disputes WHERE item_id=? AND status='Open'").get(d.item_id).n;
  if (outcome === 'dismiss' && d.prev_status === 'Returned' && !od) db.prepare("UPDATE items SET status='Returned' WHERE id=? AND status='Claimed'").run(d.item_id);
  log(d.item_id, 'dispute ' + label.toLowerCase(), notes);
  res.json({ ok: true });
});

// ID and proof photos: admin only

app.get('/private/:file', admin, (req, res) => res.sendFile(path.join(PRIV, path.basename(req.params.file))));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Campus Lost & Found running at http://localhost:${PORT}`));
