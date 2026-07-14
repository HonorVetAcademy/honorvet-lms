// ── Shared utilities ──────────────────────────────────────────

// Toast notifications
function toast(msg, type = '') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast${type ? ' toast-' + type : ''}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// Navigation guard — redirect to login if not authenticated
async function requireAuth() {
  const session = await Auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  const user = await Users.getCurrent();
  if (!user) {
    // First login — provision user record from auth metadata
    const meta = session.user.user_metadata || {};
    const provisioned = await Users.upsert(session.user.id, {
      email: session.user.email,
      name: meta.name || session.user.email.split('@')[0],
      role: meta.role || 'employee',
      department: meta.department || null,
    });
    return provisioned;
  }
  return user;
}

// Guard for admin-only pages
async function requireAdmin() {
  const user = await requireAuth();
  if (!user) return null;
  if (!['admin', 'hr'].includes(user.role)) {
    window.location.href = 'dashboard.html';
    return null;
  }
  return user;
}

// Render the sidebar nav with active state
function renderNav(activePage, user) {
  const role = user?.role || 'employee';
  const isAdmin = ['admin', 'hr'].includes(role);
  const isManager = role === 'manager';

  const nav = document.getElementById('nav-links');
  if (!nav) return;

  const items = [
    { href: 'dashboard.html', icon: iconHome(),    label: 'Dashboard',   page: 'dashboard' },
    { href: 'catalog.html',   icon: iconCatalog(), label: 'My Courses',  page: 'catalog'   },
    { href: 'paths.html',     icon: iconPath(),    label: 'My Paths',    page: 'paths'     },
  ];

  if (isAdmin || isManager) {
    items.push({ href: 'reports.html', icon: iconChart(), label: 'Reports', page: 'reports' });
  }
  if (isAdmin) {
    items.push(
      { href: 'users.html',  icon: iconUsers(),    label: 'Users',          page: 'users'  },
      { href: 'admin.html',  icon: iconSettings(), label: 'Manage Courses', page: 'admin'  }
    );
  }

  nav.innerHTML = items.map(i => `
    <a href="${i.href}" class="nav-item${activePage === i.page ? ' active' : ''}">
      ${i.icon}<span>${i.label}</span>
    </a>
  `).join('');
}

// Render user chip in sidebar footer
function renderUserChip(user) {
  const chip = document.getElementById('user-chip');
  if (!chip || !user) return;
  const initials = (user.name || user.email).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  chip.innerHTML = `
    <div class="user-avatar">${initials}</div>
    <div><div class="user-name">${user.name || 'User'}</div><div class="user-role">${user.role || 'employee'}</div></div>
  `;
  chip.onclick = async () => {
    if (confirm('Sign out?')) { await Auth.signOut(); window.location.href = 'index.html'; }
  };
}

// Format a date nicely
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Status badge HTML
function statusBadge(status) {
  const map = {
    completed:   ['badge-green',  'Completed'],
    in_progress: ['badge-yellow', 'In Progress'],
    not_started: ['badge-gray',   'Not Started'],
  };
  const [cls, label] = map[status] || ['badge-gray', status || 'Not Enrolled'];
  return `<span class="badge ${cls}">${label}</span>`;
}

// Role badge
function roleBadge(role) {
  const map = { admin: 'badge-red', hr: 'badge-blue', manager: 'badge-yellow', employee: 'badge-gray', trainer: 'badge-green' };
  return `<span class="badge ${map[role] || 'badge-gray'}">${role}</span>`;
}

// ── Course card (shared premium card used by dashboard + catalog) ──
const COURSE_GRADIENTS = [
  ['#0B1F3A', '#0056D2'], ['#0056D2', '#3B8EF3'], ['#123C66', '#0A7C4E'],
  ['#5A1020', '#C8102E'], ['#7A4B00', '#C9A227'], ['#1B3A63', '#3B5BA9'],
  ['#0A4A4E', '#12A89B'], ['#3A1F5A', '#7A4BC9'],
];

// Deterministic gradient so each course keeps a stable colour
function courseGradient(course) {
  const key = (course.tags && course.tags[0]) || course.id || course.title || '';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const [a, b] = COURSE_GRADIENTS[h % COURSE_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

// Human label for the content type (real field on the course)
function contentKind(t) {
  return { markdown: 'Reading', pdf: 'PDF', youtube: 'Video', video: 'Video', link: 'External' }[t] || 'Course';
}

function clockIcon() {
  return `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
}

// Build one premium course card. opts: { enrollment, status, actionHTML, badgeHTML }
function courseCardHTML(course, opts = {}) {
  const enr    = opts.enrollment;
  const status = opts.status || enr?.status || 'not_enrolled';
  const icon   = course.icon || '📖';
  const cat    = (course.tags && course.tags[0]) || 'Training';
  const grad   = courseGradient(course);
  const dur    = course.duration_minutes ? `${course.duration_minutes} min` : '';
  const pct    = enr?.progress || 0;

  const progressBlock = (status === 'in_progress' || status === 'completed')
    ? `<div class="cc-prog">
         <div class="cc-prog-row"><span>Progress</span><b class="${status === 'completed' ? 'ok' : ''}">${status === 'completed' ? 'Completed' : pct + '%'}</b></div>
         <div class="cc-mini"><i class="${status === 'completed' ? 'g' : 'b'}" style="width:${status === 'completed' ? 100 : pct}%"></i></div>
       </div>`
    : '';

  return `<article class="course-card">
    <div class="cc-thumb" style="background:${grad}">
      <span class="cc-wm">${icon}</span>
      <span class="cc-kind">${contentKind(course.content_type)}</span>
      ${course.is_mandatory ? '<span class="cc-mand">Mandatory</span>' : ''}
      ${dur ? `<span class="cc-dur">${clockIcon()} ${dur}</span>` : ''}
    </div>
    <div class="cc-body">
      <div class="cc-eyebrow">${cat}</div>
      <div class="cc-title">${course.title}</div>
      <div class="cc-desc">${course.description || ''}</div>
      ${progressBlock}
    </div>
    <div class="cc-foot">
      ${opts.badgeHTML || `<span class="cc-tags">${(course.tags || []).slice(0, 2).join(' · ')}</span>`}
      ${opts.actionHTML || ''}
    </div>
  </article>`;
}

// SVG progress ring (used by the dashboard "continue learning" hero)
function progressRing(pct, size = 132, stroke = 12) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  const cx = size / 2;
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs><linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B8EF3"/><stop offset="1" stop-color="#7FB0FF"/></linearGradient></defs>
      <circle class="ring-bg" cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke-width="${stroke}"/>
      <circle class="ring-fg" cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
    </svg>
    <div class="ring-mid"><div class="ring-pv">${pct}%</div><div class="ring-pl">COMPLETE</div></div>
  </div>`;
}

// Simple markdown → HTML (handles headings, bold, italic, code, links, images, lists, hr, tables)
function markdownToHtml(md) {
  if (!md) return '';
  let html = md
    // Fenced code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang}">${escHtml(code.trim())}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
    // Images before links
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Headings
    .replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')
    // Bold / italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Blockquote
    .replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')
    // HR
    .replace(/^---$/gm, '<hr>')
    // Unordered list items
    .replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>')
    // Ordered list items
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<oli>$1</oli>')
    // Wrap <li> groups
    .replace(/(<li>[\s\S]+?<\/li>)(?!\s*<li>)/g, m => `<ul>${m}</ul>`)
    .replace(/(<oli>[\s\S]+?<\/oli>)(?!\s*<oli>)/g, m => `<ol>${m.replace(/<\/?oli>/g, m2 => m2.replace('oli','li'))}</ol>`)
    // Paragraphs (double newline)
    .replace(/\n\n(?!<[houbl])/g, '</p><p>')
  ;
  // Wrap top-level text in <p>
  if (!html.startsWith('<')) html = '<p>' + html;
  if (!html.endsWith('>')) html += '</p>';
  return html;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Fetch a GitHub repo's README and render it
async function fetchGithubReadme(repoUrl) {
  // https://github.com/owner/repo  →  raw README URL
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/?\s]+)/);
  if (!match) return null;
  const [, owner, repo] = match;
  const branches = ['main', 'master'];
  for (const branch of branches) {
    const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`;
    try {
      const res = await fetch(raw);
      if (res.ok) return await res.text();
    } catch {}
  }
  return null;
}

// Simple SVG icons (inline, no CDN)
// Render notification bell into a container element by id
async function renderNotifBell(userId, containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  let notifs = [];
  try { notifs = await Notifications.getUnread(userId); } catch {}
  const count = notifs.length;

  wrap.innerHTML = `
    <div style="position:relative;display:inline-block">
      <button class="btn btn-ghost btn-sm" id="notif-btn" onclick="toggleNotifPanel()" style="position:relative;padding:6px 10px">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        ${count > 0 ? `<span class="notif-badge">${count > 9 ? '9+' : count}</span>` : ''}
      </button>
      <div id="notif-panel" class="notif-panel" style="display:none">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)">
          <span style="font-weight:700;font-size:13.5px">Notifications</span>
          ${count > 0 ? `<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="markAllRead('${userId}')">Mark all read</button>` : ''}
        </div>
        <div id="notif-list" style="max-height:320px;overflow-y:auto">
          ${notifs.length === 0
            ? `<div style="padding:24px 16px;text-align:center;color:var(--text-muted);font-size:13px">No new notifications</div>`
            : notifs.map(n => `
              <div class="notif-item">
                <div style="font-size:13px;font-weight:600">${n.title}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${n.body || ''}</div>
                <div style="font-size:11px;color:var(--text-dim);margin-top:4px">${fmtDate(n.created_at)}</div>
              </div>`).join('')
          }
        </div>
      </div>
    </div>`;
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

async function markAllRead(userId) {
  try {
    await Notifications.markAllRead(userId);
    document.getElementById('notif-panel').style.display = 'none';
    renderNotifBell(userId, 'notif-bell-wrap');
    toast('All notifications marked as read.', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

document.addEventListener('click', e => {
  const panel = document.getElementById('notif-panel');
  const btn   = document.getElementById('notif-btn');
  if (panel && btn && !btn.contains(e.target) && !panel.contains(e.target)) {
    panel.style.display = 'none';
  }
});

function iconHome()     { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`; }
function iconCatalog()  { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`; }
function iconChart()    { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`; }
function iconUsers()    { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`; }
function iconSettings() { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`; }
function iconPath()     { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="12" cy="19" r="2"/><line x1="12" y1="7" x2="19" y2="10"/><line x1="19" y1="14" x2="12" y2="17"/></svg>`; }
function iconPlus()     { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`; }
function iconEdit()     { return `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`; }
function iconTrash()    { return `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`; }
function iconUpload()   { return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>`; }

// Tabs setup
function setupTabs(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    };
  });
}

// Modal helpers
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});
