const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CATS = ['Phone / Electronics', 'Wallet / Bag', 'ID / Cards', 'Keys', 'Clothing', 'Books / Stationery', 'Other'];
const STATUSES = ['Lost', 'Found', 'Pending Claim', 'Disputed', 'Claimed', 'Returned'];
const colorOf = s => `var(--${s.split(' ')[0]})`;
const ICONS = {
  dash: 'M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z', items: 'M21 8l-9-5-9 5v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8',
  claims: 'M6 3h9l4 4v14H6z M9 12h7 M9 16h7', archive: 'M3 4h18v4H3z M5 8v12h14V8 M10 12h4', plus: 'M12 5v14 M5 12h14',
  edit: 'M4 20l4-1 11-11-3-3L5 16z', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  lost: 'M12 3l10 18H2z M12 10v5 M12 18v.01', found: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8 12l3 3 5-6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2', x: 'M6 6l12 12 M18 6L6 18', undo: 'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5',
  out: 'M9 4H5v16h4 M16 8l4 4-4 4 M20 12H9', in: 'M15 4h4v16h-4 M8 8l-4 4 4 4 M4 12h11', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M21 21l-5-5',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10 21a2 2 0 0 0 4 0', sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  theme: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z'
};
const icon = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[n]}"/></svg>`;
let ME = { name: 'Admin', username: 'admin' }, isAdmin = false, tab = 'dash', F = { q: '', status: '', category: '' }, PG = 1, CUR = {}, DI = [], timer;
const PER = 7;

async function api(url, opt = {}) {
  const r = await fetch(url, opt), d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
const post = (u, b) => api(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
function toast(m, err) { const t = $('#toast'); t.textContent = m; t.className = 'show' + (err ? ' err' : ''); setTimeout(() => t.className = '', 2800); }
const show = html => { $('#dlg').innerHTML = `<div class="dbody">${html}</div>`; if (!$('#dlg').open) $('#dlg').showModal(); };
const closeDlg = () => $('#dlg').close();
const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); closeDlg(); refresh(); } catch (e) { toast(e.message, true); } };
const ago = s => { const m = Math.round((Date.now() - new Date(s.replace(' ', 'T') + 'Z')) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };



// ---- Theme & auth ----

function toggleTheme() { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); themeLabel(); }
function themeLabel() { const d = document.documentElement.dataset.theme === 'dark'; $('#themeBtn').innerHTML = icon(d ? 'sun' : 'theme'); $('#themeBtn').title = $('#themeBtn').ariaLabel = d ? 'Switch to light mode' : 'Switch to dark mode'; }
async function init() {
  document.querySelectorAll('[data-i]').forEach(e => e.innerHTML = icon(e.dataset.i));
  themeLabel(); ME = await api('/api/me'); isAdmin = ME.admin; applyAuth(); refresh();
}
function applyAuth() {
  document.body.classList.toggle('is-admin', isAdmin);
  $('#authBtn').innerHTML = icon('out') + 'Log out';
  $('#av').textContent = (ME.name || 'A')[0].toUpperCase(); $('#uname').textContent = ME.name || 'Admin'; $('#urole').textContent = 'Administrator';
  if (!isAdmin && ['claims', 'archive', 'disputes'].includes(tab)) tab = 'dash';
}
function authClick() {
  if (isAdmin) return post('/api/logout').then(() => { isAdmin = false; applyAuth(); toast('Logged out'); refresh(); });
  show(`<h2>Admin login</h2><form onsubmit="login(event)"><label>Username</label><input name="username" required autofocus>
  <label>Password</label><input name="password" type="password" required>
  <div class="foot"><button type="button" class="sec" onclick="closeDlg()">Cancel</button><button>Log in</button></div></form>`);
}
function login(e) { e.preventDefault(); const f = e.target; run(async () => { await post('/api/login', { username: f.username.value, password: f.password.value }); ME = await api('/api/me'); isAdmin = true; applyAuth(); }, 'Logged in'); }

function profileDialog() {
  show(`<h2>Profile</h2><form onsubmit="saveProfile(event)">
  <label>Display name</label><input name="display_name" required value="${esc(ME.name)}">
  <label>Username (used to log in)</label><input name="username" required value="${esc(ME.username)}">
  <label>New password (leave blank to keep the current one)</label><input name="new_password" type="password" minlength="6" autocomplete="new-password">
  <label>Current password (required to save)</label><input name="current_password" type="password" required autocomplete="current-password">
  <div class="foot"><button type="button" class="sec" onclick="closeDlg()">Cancel</button><button>Save profile</button></div></form>`);
}
function saveProfile(e) {
  e.preventDefault(); const f = e.target;
  run(async () => { await api('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(f))) }); ME = await api('/api/me'); applyAuth(); }, 'Profile updated');
}
function bellClick() {
  const c = (window.BELL || {}).PendingClaims || 0, d = (window.BELL || {}).OpenDisputes || 0;
  if (c && !d) return setTab('claims');
  if (d && !c) return setTab('disputes');
  if (!c && !d) return toast('Nothing needs review right now');
  show(`<h2>Needs review</h2><div class="foot" style="flex-direction:column;align-items:stretch">
  <button onclick="closeDlg();setTab('claims')">${c} claim${c > 1 ? 's' : ''} waiting for review</button>
  <button onclick="closeDlg();setTab('disputes')">${d} open dispute${d > 1 ? 's' : ''}</button></div>
  <div class="foot"><button class="sec" onclick="closeDlg()">Close</button></div>`);
}



// ---- Navigation ----

function setTab(t) { tab = t; PG = 1; refresh(); }
function gsearch(v) { clearTimeout(timer); timer = setTimeout(() => { F.q = v; PG = 1; if (['claims', 'disputes'].includes(tab)) { tab = 'dash'; return refresh(); } loadList(); }, 200); }
async function refresh() {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  const S = await api('/api/stats').catch(() => null); if (!S) return;
  const T = { dash: isAdmin ? [`Welcome back, <em>${esc(ME.name)}</em>!`, 'Here is an overview of reported items, claims and activity.'] : ['Welcome to <em>Campus Lost &amp; Found</em>', 'Lost something or found something? Report it or look it up here.'],
    items: ['Browse Items', 'All active reports on campus.'], claims: ['Claim reviews', 'Check the evidence, then approve or reject.'], disputes: ['Disputes', 'Review each dispute and decide whether to keep or reopen the item.'], archive: ['Archive', 'Archived items can be restored if there is a dispute.'] }[tab];
  $('#hello').innerHTML = T[0]; $('#sub').textContent = T[1];
  $('#bellN').textContent = (S.PendingClaims + S.OpenDisputes) || ''; window.BELL = S;
  try { if (tab === 'dash') await renderDash(S); else if (tab === 'claims') await renderClaims(); else if (tab === 'disputes') await renderDisputes(); else renderCards(); } catch (e) { toast(e.message, true); }
}
const qs = () => new URLSearchParams({ ...F, archived: tab === 'archive' ? 1 : 0 });
async function loadList() {
  const items = await api('/api/items?' + qs()); items.forEach(i => CUR[i.id] = i);
  if (tab === 'dash') { DI = items; drawTable(); } else drawCards(items);
}



// ---- Dashboard ----

const GR = { total: ['#6a3df0', '#3b2aa8'], Lost: ['#ff4d7a', '#a8205e'], Found: ['#14b88a', '#0c6e66'], pend: ['#ff9a2b', '#a8501a'], done: ['#2f7cff', '#1b3fa8'] };
async function renderDash(S) {
  const [items, act] = await Promise.all([api('/api/items?' + qs()), api('/api/activity')]);
  items.forEach(i => CUR[i.id] = i); DI = items;
  const total = STATUSES.reduce((a, k) => a + S[k], 0), pend = S.PendingClaims + S.OpenDisputes, done = S.Claimed + S.Returned;
  const card = (g, ic, n, l, sm) => `<div class="stat" style="--g1:${g[0]};--g2:${g[1]}"><div class="ico">${icon(ic)}</div><div><b>${n}</b><span>${l}</span><small>${sm}</small></div></div>`;
  const AM = { created: ['plus', 'Lost', 'New report:'], 'claim submitted': ['claims', 'Claimed', 'Claim submitted for'], 'claim approved': ['found', 'Found', 'Claim approved for'], 'claim rejected': ['x', 'Lost', 'Claim rejected for'], archived: ['archive', 'Archived', 'Archived'], restored: ['undo', 'Returned', 'Restored'], edited: ['edit', 'Pending', 'Updated'], 'dispute filed': ['lost', 'Disputed', 'Dispute filed for'], 'dispute upheld': ['x', 'Lost', 'Dispute upheld for'], 'dispute dismissed': ['found', 'Found', 'Dispute dismissed for'] };
  const qa = (g, ic, t, fn) => `<button style="--g1:${g[0]};--g2:${g[1]}" onclick="${fn}">${icon(ic)}${t}</button>`;
  $('#view').innerHTML = `<div class="stats">${card(GR.total, 'items', total, 'Total Items', 'active reports')}${card(GR.Lost, 'lost', S.Lost, 'Lost', 'still missing')}${card(GR.Found, 'found', S.Found, 'Found', 'waiting for owner')}${card(GR.pend, 'clock', pend, 'Needs Review', 'claims and disputes')}${card(GR.done, 'claims', done, 'Resolved', 'claimed or returned')}</div>
  <div class="dash"><div class="col">
    <section class="panel"><div class="ph">${icon('items')}<h2>Manage Items</h2><div class="sp"><select id="fs" aria-label="Status"><option value="">All statuses</option>${STATUSES.map(s => `<option ${F.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
      <div class="tw"><table class="tbl"><thead><tr><th>Item</th><th>Category</th><th>Where</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody id="tb"></tbody></table></div><div class="pager" id="pg"></div></section>
    <section class="panel"><div class="ph">${icon('found')}<h2>System Overview</h2></div><div class="ok">System running normally</div>
        <div class="ov"><div><b>${total}</b><span>Total items</span></div><div><b>${pend}</b><span>Pending</span></div><div><b>${total ? Math.round(done / total * 100) : 0}%</b><span>Recovered</span></div></div></section></div>
    <div class="col">
      <section class="panel"><div class="ph">${icon('plus')}<h2>Quick Actions</h2></div><div class="qa">
        ${qa(['#ff4d7a', '#ff9a2b'], 'plus', 'Report Item', 'itemDialog()')}${qa(['#7b3cff', '#4d3cff'], 'items', 'Browse Items', "setTab('items')")}
        ${isAdmin ? qa(['#3d5bff', '#2a8cff'], 'claims', 'Review Claims', "setTab('claims')") + qa(['#14b8c8', '#2a8cff'], 'archive', 'Archive', "setTab('archive')")
      : qa(['#3d5bff', '#2a8cff'], 'in', 'Admin Login', 'authClick()') + qa(['#14b8c8', '#2a8cff'], 'theme', 'Switch Theme', 'toggleTheme()')}</div></section>
      <section class="panel"><div class="ph">${icon('clock')}<h2>Recent Activity</h2></div><div class="feed">${act.map(r => { const m = AM[r.action] || AM.edited; return `<div><span class="fi" style="--c:${colorOf(m[1])}">${icon(m[0])}</span><span>${m[2]} <b>${esc(r.item_name)}</b><small>${ago(r.created_at)}</small></span></div>`; }).join('') || '<div class="empty">No activity yet.</div>'}</div></section>
    </div></div>`;
  $('#fs').onchange = e => { F.status = e.target.value; PG = 1; loadList(); };
  drawTable();
}
function drawTable() {
  const pages = Math.max(1, Math.ceil(DI.length / PER)); PG = Math.min(PG, pages);
  const rows = DI.slice((PG - 1) * PER, PG * PER);
  $('#tb').innerHTML = rows.map(i => `<tr><td><div class="cellitem"><span class="mini">${esc(i.category[0])}${i.photo ? `<img src="/uploads/items/${esc(i.photo)}" alt="">` : ''}</span>${esc(i.name)}</div></td>
    <td>${esc(i.category)}</td><td>${esc(i.location)}</td><td>${esc(i.date)}</td><td><span class="badge" style="--c:${colorOf(i.status)}">${i.status}${i.pending ? ` (${i.pending})` : ''}</span></td>
    <td class="acts"><button class="ib" title="View" onclick="detail(${i.id})">${icon('eye')}</button>${isAdmin ? `<button class="ib" title="Edit" onclick="itemDialog(CUR[${i.id}])">${icon('edit')}</button><button class="ib" title="Archive" onclick="reasonDialog(${i.id},'archive')">${icon('archive')}</button>` : ''}</td></tr>`).join('')
    || '<tr><td colspan="6" class="empty">No items match. Use Report Item to add one.</td></tr>';
  $('#pg').innerHTML = `<span>Showing ${DI.length ? (PG - 1) * PER + 1 : 0}-${Math.min(PG * PER, DI.length)} of ${DI.length} items</span><div><button class="sec" ${PG <= 1 ? 'disabled' : ''} onclick="PG--;drawTable()">Prev</button><span>${PG} / ${pages}</span><button class="sec" ${PG >= pages ? 'disabled' : ''} onclick="PG++;drawTable()">Next</button></div>`;
}


// ---- Browse / Archive cards ----

function renderCards() {
  $('#view').innerHTML = `<div class="filters"><select id="fs" aria-label="Status"><option value="">All statuses</option>${STATUSES.map(s => `<option ${F.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <select id="fc" aria-label="Category"><option value="">All categories</option>${CATS.map(c => `<option ${F.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div><div id="list" class="grid"></div>`;
  $('#fs').onchange = e => { F.status = e.target.value; loadList(); }; $('#fc').onchange = e => { F.category = e.target.value; loadList(); };
  loadList();
}
function drawCards(items) {
  const arch = tab === 'archive';
  $('#list').innerHTML = items.length ? items.map(i => `<div class="card" onclick="detail(${i.id})" tabindex="0" onkeydown="if(event.key==='Enter')detail(${i.id})">
    <div class="cph" style="--c:${colorOf(i.status)}">${esc(i.category[0])}${i.photo ? `<img src="/uploads/items/${esc(i.photo)}" alt="">` : ''}<span class="badge" style="--c:${colorOf(i.status)}">${i.status}${i.pending ? ` (${i.pending})` : ''}</span></div>
    <div class="cbody"><h3>${esc(i.name)}</h3><p>${esc(i.location)} - ${esc(i.date)}</p><p>${esc(i.category)}</p>${arch ? `<p>Archived: ${esc(i.archive_reason)}</p>` : ''}</div></div>`).join('')
    : `<div class="empty">${arch ? 'No archived items.' : 'No items match. Use Report Item to add one.'}</div>`;
}



// ---- Item dialogs ----

function itemDialog(it) {
  const e = !!it; it = it || { status: 'Lost', date: new Date().toISOString().slice(0, 10) };
  show(`<h2>${e ? 'Edit item' : 'Report an item'}</h2><form onsubmit="saveItem(event,${e ? it.id : 0})">
  <label>Item name</label><input name="name" required value="${esc(it.name)}">
  <div class="two"><div><label>Category</label><select name="category">${CATS.map(c => `<option ${c === it.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
  <div><label>Status</label><select name="status">${(e ? STATUSES : ['Lost', 'Found']).map(s => `<option ${s === it.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
  <div class="two"><div><label>Where</label><input name="location" required value="${esc(it.location)}"></div>
  <div><label>Date</label><input type="date" name="date" required value="${esc(it.date)}"></div></div>
  <label>Description</label><textarea name="description" rows="3">${esc(it.description)}</textarea>
  <label>Photo (optional)</label><input type="file" name="photo" accept="image/*">
  <div class="foot"><button type="button" class="sec" onclick="closeDlg()">Cancel</button><button>${e ? 'Save changes' : 'Submit report'}</button></div></form>`);
}
function saveItem(ev, id) { ev.preventDefault(); run(() => api(id ? '/api/items/' + id : '/api/items', { method: id ? 'PUT' : 'POST', body: new FormData(ev.target) }), id ? 'Changes saved' : 'Item reported'); }

async function detail(id) {
  const it = CUR[id] || (CUR[id] = await api('/api/items/' + id));
  let extra = '';
  if (isAdmin) {
    const [claims, hist, ds] = await Promise.all([api('/api/claims?item_id=' + id), api(`/api/items/${id}/history`), api('/api/disputes?item_id=' + id)]);
    extra = `<h3>Claims (${claims.length})</h3>${claims.map(claimHtml).join('') || '<p class="empty">No claims yet.</p>'}
      <h3>Disputes (${ds.length})</h3>${ds.map(disputeHtml).join('') || '<p class="empty">No disputes.</p>'}
      <h3>History</h3><ul class="hist">${hist.map(h => `<li>${esc(h.created_at)} - <b>${esc(h.action)}</b> ${esc(h.reason)}</li>`).join('')}</ul>`;
  }
  const canDispute = ['Pending Claim', 'Disputed', 'Claimed', 'Returned'].includes(it.status) && !it.is_archived && !isAdmin;
  const canClaim = ['Found', 'Pending Claim', 'Disputed', 'Claimed'].includes(it.status) && !it.is_archived && !isAdmin;
  show(`<h2>${esc(it.name)} <span class="badge" style="--c:${colorOf(it.status)}">${it.status}</span></h2>
  ${it.photo ? `<img class="bigimg" src="/uploads/items/${esc(it.photo)}" alt="${esc(it.name)}">` : ''}
  <dl class="kv"><dt>Category</dt><dd>${esc(it.category)}</dd><dt>Where</dt><dd>${esc(it.location)}</dd><dt>Date</dt><dd>${esc(it.date)}</dd>
  <dt>Description</dt><dd>${esc(it.description) || '-'}</dd>${it.is_archived ? `<dt>Archived</dt><dd>${esc(it.archived_at)}: ${esc(it.archive_reason)}</dd>` : ''}</dl>${extra}
  <div class="foot"><button class="sec" onclick="closeDlg()">Close</button>
  ${canClaim ? `<button class="good" onclick="claimDialog(${id})">This is mine - claim it</button>` : ''}
  ${canDispute ? `<button class="sec" onclick="disputeDialog(${id})">Report a dispute</button>` : ''}
  ${isAdmin && !it.is_archived ? `<button onclick="itemDialog(CUR[${id}])">Edit</button><button class="sec" onclick="reasonDialog(${id},'archive')">Archive</button>` : ''}
  ${isAdmin && it.is_archived ? `<button class="good" onclick="reasonDialog(${id},'restore')">Restore</button><button class="bad" onclick="delItem(${id})">Delete permanently</button>` : ''}</div>`);
}
function reasonDialog(id, act) {
  show(`<h2>${act === 'archive' ? 'Archive item' : 'Restore item'}</h2><form onsubmit="doReason(event,${id},'${act}')">
  <label>${act === 'archive' ? 'Reason (e.g. returned to owner, unclaimed for 30 days)' : 'Reason (e.g. disputed by another claimant)'}</label>
  <input name="reason" required autofocus><div class="foot"><button type="button" class="sec" onclick="closeDlg()">Cancel</button><button>${act === 'archive' ? 'Archive item' : 'Restore item'}</button></div></form>`);
}
function doReason(e, id, act) { e.preventDefault(); run(() => post(`/api/items/${id}/${act}`, { reason: e.target.reason.value }), act === 'archive' ? 'Item archived' : 'Item restored'); }
function delItem(id) {
  show(`<h2>Delete permanently?</h2><p>This removes the item, its claims and uploaded photos. It cannot be undone.</p>
  <div class="foot"><button class="sec" onclick="closeDlg()">Cancel</button><button class="bad" onclick="doDelete(${id})">Delete permanently</button></div>`);
}
function doDelete(id) { run(() => api('/api/items/' + id, { method: 'DELETE' }), 'Item deleted'); }



// ---- Claims ----

function claimDialog(id) {
  show(`<h2>Claim: ${esc(CUR[id].name)}</h2><p>Your details are seen by campus admins only.</p><form onsubmit="saveClaim(event,${id})">
  <label>Full name</label><input name="claimant_name" required>
  <div class="two"><div><label>Contact number</label><input name="contact_number" required></div>
  <div><label>Address</label><input name="address" required></div></div>
  <div class="two"><div><label>ID type</label><select name="id_type"><option>Student ID</option><option>Driver's license</option><option>National ID</option><option>Passport</option></select></div>
  <div><label>ID number</label><input name="id_number" required></div></div>
  <div class="two"><div><label>Photo of your ID</label><input type="file" name="id_photo" accept="image/*" required></div>
  <div><label>Proof of ownership photo</label><input type="file" name="proof_photo" accept="image/*" required></div></div>
  <label>Details only the owner would know</label><textarea name="description" rows="3" required></textarea>
  <div class="foot"><button type="button" class="sec" onclick="closeDlg()">Cancel</button><button>Submit claim</button></div></form>`);
}
function saveClaim(e, id) { e.preventDefault(); run(() => api(`/api/items/${id}/claims`, { method: 'POST', body: new FormData(e.target) }), 'Claim submitted. An admin will review it.'); }
function claimHtml(c) {
  const col = c.status === 'Approved' ? 'var(--Found)' : c.status === 'Rejected' ? 'var(--Lost)' : 'var(--Pending)';
  return `<div class="claim"><b>${esc(c.claimant_name)}</b> <span class="badge" style="--c:${col}">${c.status}</span>
  <dl class="kv"><dt>Contact</dt><dd>${esc(c.contact_number)}</dd><dt>Address</dt><dd>${esc(c.address)}</dd><dt>${esc(c.id_type)}</dt><dd>${esc(c.id_number)}</dd>
  <dt>Details</dt><dd>${esc(c.description)}</dd>${c.admin_notes ? `<dt>Admin notes</dt><dd>${esc(c.admin_notes)}</dd>` : ''}</dl>
  <a href="/private/${esc(c.id_photo)}" target="_blank"><img src="/private/${esc(c.id_photo)}" alt="ID photo"></a>
  <a href="/private/${esc(c.proof_photo)}" target="_blank"><img src="/private/${esc(c.proof_photo)}" alt="Proof photo"></a>
  ${c.status === 'Pending' ? `<div class="foot"><button class="bad" onclick="decide(${c.id},'Rejected')">Reject</button><button class="good" onclick="decide(${c.id},'Approved')">Approve</button></div>` : ''}</div>`;
}
function decide(id, d) {
  const ap = d === 'Approved';
  show(`<h2>${ap ? 'Approve claim' : 'Reject claim'}</h2><form onsubmit="doDecide(event,${id},'${d}')">
  <label>${ap ? 'Notes (optional)' : 'Reason for rejecting (required)'}</label><textarea name="notes" rows="3" ${ap ? '' : 'required'} autofocus></textarea>
  <div class="foot"><button type="button" class="sec" onclick="closeDlg()">Cancel</button><button class="${ap ? 'good' : 'bad'}">${ap ? 'Approve claim' : 'Reject claim'}</button></div></form>`);
}
function doDecide(e, id, d) { e.preventDefault(); run(() => post(`/api/claims/${id}/decision`, { decision: d, notes: e.target.notes.value }), `Claim ${d.toLowerCase()}`); }
// ---- Disputes ----
function disputeDialog(id) {
  show(`<h2>Report a dispute: ${esc(CUR[id].name)}</h2><p>Use this if you believe this item was given or claimed wrongly. An admin will review it.</p>
  <form onsubmit="saveDispute(event,${id})"><label>Your full name</label><input name="disputant_name" required>
  <label>Contact number</label><input name="contact_number" required>
  <label>Reason for the dispute</label><textarea name="reason" rows="3" required></textarea>
  <label>Evidence photo (optional)</label><input type="file" name="evidence_photo" accept="image/*">
  <div class="foot"><button type="button" class="sec" onclick="closeDlg()">Cancel</button><button>Submit dispute</button></div></form>`);
}
function saveDispute(e, id) { e.preventDefault(); run(() => api(`/api/items/${id}/disputes`, { method: 'POST', body: new FormData(e.target) }), 'Dispute submitted. An admin will review it.'); }
function disputeHtml(d) {
  const col = d.status === 'Open' ? 'var(--Pending)' : d.status === 'Upheld' ? 'var(--Lost)' : 'var(--Found)';
  return `<div class="claim"><b>${esc(d.disputant_name)}</b> <span class="badge" style="--c:${col}">${d.status}</span>
  <dl class="kv"><dt>Contact</dt><dd>${esc(d.contact_number)}</dd><dt>Reason</dt><dd>${esc(d.reason)}</dd><dt>Filed</dt><dd>${esc(d.created_at)}</dd>${d.resolution ? `<dt>Resolution</dt><dd>${esc(d.resolution)}</dd>` : ''}</dl>
  ${d.evidence_photo ? `<a href="/private/${esc(d.evidence_photo)}" target="_blank"><img src="/private/${esc(d.evidence_photo)}" alt="Evidence photo"></a>` : ''}
  ${d.status === 'Open' ? `<div class="foot"><button onclick="resolveDialog(${d.id})">Resolve dispute</button></div>` : ''}</div>`;
}
function resolveDialog(id) {
  show(`<h2>Resolve dispute</h2><form onsubmit="doResolve(event,${id})"><label>Decision</label>
  <select name="outcome"><option value="dismiss">Dismiss - keep the current decision</option><option value="uphold">Uphold - reopen the item for a new review</option></select>
  <label>Resolution notes (required)</label><textarea name="notes" rows="3" required></textarea>
  <div class="foot"><button type="button" class="sec" onclick="closeDlg()">Cancel</button><button>Save decision</button></div></form>`);
}
function doResolve(e, id) { e.preventDefault(); run(() => post(`/api/disputes/${id}/resolve`, { outcome: e.target.outcome.value, notes: e.target.notes.value }), 'Dispute resolved'); }
async function renderDisputes() {
  const ds = await api('/api/disputes');
  $('#view').innerHTML = ds.map(d => `<section class="panel" style="margin-bottom:14px"><div class="ph">${icon('lost')}<h2>${esc(d.item_name)}</h2><div class="sp"><button class="sec" onclick="detail(${d.item_id})">View item</button></div></div>${disputeHtml(d)}</section>`).join('') || '<div class="empty">No disputes filed.</div>';
}
async function renderClaims() {
  const cs = await api('/api/claims');
  $('#view').innerHTML = cs.map(c => `<section class="panel" style="margin-bottom:14px"><div class="ph">${icon('items')}<h2>${esc(c.item_name)}</h2></div>${claimHtml(c)}</section>`).join('') || '<div class="empty">No claims yet.</div>';
}
init();
