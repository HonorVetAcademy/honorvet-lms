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
    { href: 'dashboard.html', icon: iconHome(),    label: 'Dashboard',      page: 'dashboard' },
    { href: 'catalog.html',   icon: iconCatalog(), label: 'My Courses',     page: 'catalog'   },
    { href: 'paths.html',     icon: iconPath(),    label: 'Learning Paths', page: 'paths'     },
  ];

  if (isAdmin || isManager) {
    items.push({ href: 'reports.html', icon: iconChart(), label: 'Reports', page: 'reports' });
  }
  if (isAdmin) {
    items.push(
      { href: 'users.html',  icon: iconUsers(),    label: 'Users',          page: 'users' },
      { href: 'admin.html',  icon: iconSettings(), label: 'Manage Courses', page: 'admin' }
    );
  }

  nav.innerHTML = items.map(i => {
    const active = activePage === i.page;
    const iconColor = active ? '#EE1A0F' : '#808286';
    const iconBg    = active ? 'transparent' : 'transparent';
    return `<a href="${i.href}" class="nav-item${active ? ' active' : ''}">
      <span class="nav-ico" style="color:${iconColor};background:${iconBg}">${i.icon}</span>
      <span>${i.label}</span>
    </a>`;
  }).join('');
}

// Global topbar search — Enter navigates to the catalog with the query
function topSearchHTML(placeholder = 'Search courses…') {
  return `<form class="topbar-search" onsubmit="return goTopSearch(event)">
    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="search" id="top-search" placeholder="${placeholder}">
  </form>`;
}
function goTopSearch(e) {
  e.preventDefault();
  const q = (document.getElementById('top-search')?.value || '').trim();
  location.href = 'catalog.html' + (q ? '?q=' + encodeURIComponent(q) : '');
  return false;
}

// Category colour palette: one quiet charcoal icon treatment + brand-red
// count text, matching the approved premium direction (no rainbow variety).
const CAT_COLORS = [
  { c: '#EE1A0F', g: 'linear-gradient(135deg,#231F20,#3A3436)' },
];
function catIcon(tag) {
  const t = (tag || '').toLowerCase();
  if (/secur|cyber|phish/.test(t)) return '🛡️';
  if (/cloud|azure|aws/.test(t))   return '☁️';
  if (/data|analy|ai|power/.test(t)) return '📊';
  if (/lead|manage|team/.test(t))  return '🎖️';
  if (/safe|compli|osha|hr/.test(t)) return '⚠️';
  if (/it|support|hardware|network/.test(t)) return '💻';
  if (/dev|code|program|software/.test(t)) return '⚙️';
  return '📚';
}

// Colourful category tiles (counts computed from real course tags)
function categoryTilesHTML(courses, limit = 6) {
  const counts = {};
  courses.forEach(c => (c.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
  const cats = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (!cats.length) return '';
  return `<div class="cat-tiles">` + cats.map(([tag, n], i) => {
    const col = CAT_COLORS[i % CAT_COLORS.length];
    return `<a class="cat-tile" href="catalog.html?tag=${encodeURIComponent(tag)}">
      <div class="cat-ico" style="background:${col.g}">${catIcon(tag)}</div>
      <div class="cat-name">${tag}</div>
      <div class="cat-count" style="color:${col.c}">${n} course${n !== 1 ? 's' : ''}</div>
    </a>`;
  }).join('') + `</div>`;
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
// Charcoal-family fallback for courses with no matched cover photo — quiet
// and consistent rather than the old per-course rainbow.
const COURSE_GRADIENTS = [
  ['#231F20', '#3A3436'], ['#332C2E', '#4A4345'], ['#231F20', '#5C5457'],
];

// Simple deterministic string hash — same input always gives the same
// number, so a course keeps a stable pick across repeat visits.
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// Deterministic gradient so each course keeps a stable colour
function courseGradient(course) {
  const key = (course.tags && course.tags[0]) || course.id || course.title || '';
  const [a, b] = COURSE_GRADIENTS[hashStr(key) % COURSE_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

// Real, relevant cover photos for known tracks (Unsplash, free-to-use license).
// A course qualifies if any of its tags matches a key below. Each track lists
// its candidate photos — resolveCoverImage() picks the first one not already
// showing on another course in the same page load.
const TRACK_COVER_IMAGES = {
  'US Healthcare Fresher':               ['https://images.unsplash.com/photo-1504813184591-01572f98c85f?w=900&h=500&fit=crop&auto=format&q=80'],
  'US Healthcare Physicians & Locums':   ['https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=900&h=500&fit=crop&auto=format&q=80'],
  'US Healthcare VMSs':                  ['https://images.unsplash.com/photo-1635350736475-c8cef4b21906?w=900&h=500&fit=crop&auto=format&q=80'],
  'US Healthcare Refresher':             ['https://images.unsplash.com/photo-1516841273335-e39b37888115?w=900&h=500&fit=crop&auto=format&q=80'],
  'US IT Fresher':                       ['https://images.unsplash.com/photo-1629904853893-c2c8981a1dc5?w=900&h=500&fit=crop&auto=format&q=80'],
  'US IT Refresher':                     ['https://images.unsplash.com/photo-1531482615713-2afd69097998?w=900&h=500&fit=crop&auto=format&q=80'],
};

// Broader topical matching: scans the course title/description/tags for
// keywords so a photo shows up even without an exact track tag. SPECIFIC
// entries are checked before track tags (a course titled "Types of
// Facilities" should get the facility photo even if it's also tagged with a
// broad track like "US Healthcare Fresher"). GENERIC entries are checked
// only as a last resort, after track tags, so a word like "refresher" never
// shadows a course's more precise track-specific photo (e.g. "US IT
// Refresher" has its own distinct photo from the generic refresher one).
const SPECIFIC_KEYWORD_COVER_IMAGES = [
  { keywords: ['nurse', 'nursing'], images: [
      'https://images.unsplash.com/photo-1758575514475-2a84975db58e?w=900&h=500&fit=crop&auto=format&q=80',
      'https://images.unsplash.com/photo-1758653500493-5c8f44ff3d10?w=900&h=500&fit=crop&auto=format&q=80',
      'https://images.unsplash.com/photo-1631815590058-860e4f83c1e8?w=900&h=500&fit=crop&auto=format&q=80',
  ]},
  { keywords: ['physician', 'locum', 'doctor'],                                    images: ['https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=900&h=500&fit=crop&auto=format&q=80'] },
  { keywords: ['cybersecurity', 'cyber security', 'phishing', 'password security'], images: ['https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=900&h=500&fit=crop&auto=format&q=80'] },
  { keywords: ['safety', 'osha', 'hazard'],                                        images: ['https://images.unsplash.com/photo-1760963301666-582b92218a19?w=900&h=500&fit=crop&auto=format&q=80'] },
  { keywords: ['leadership', 'management', 'manager', 'supervisor'],               images: ['https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=900&h=500&fit=crop&auto=format&q=80'] },
  { keywords: ['cloud', 'azure', 'aws', 'data', 'analytics', 'power bi'],          images: ['https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&h=500&fit=crop&auto=format&q=80'] },
  { keywords: ['resume', 'curriculum vitae', ' cv '],                              images: ['https://images.unsplash.com/photo-1698047681432-006d2449c631?w=900&h=500&fit=crop&auto=format&q=80'] },
  { keywords: ['job description', 'job posting'],                                 images: ['https://images.unsplash.com/photo-1761558794306-466448dab4bc?w=900&h=500&fit=crop&auto=format&q=80'] },
  { keywords: ['recruitment lifecycle', 'recruiter', 'sourcing'],                  images: ['https://images.unsplash.com/photo-1758518730162-09a142505bfd?w=900&h=500&fit=crop&auto=format&q=80'] },
  { keywords: ['vms', 'vendor management', 'staffing', 'hiring', 'recruit'],       images: ['https://images.unsplash.com/photo-1635350736475-c8cef4b21906?w=900&h=500&fit=crop&auto=format&q=80'] },
  { keywords: ['software', 'developer', 'programming', 'coding', 'information technology'], images: ['https://images.unsplash.com/photo-1629904853893-c2c8981a1dc5?w=900&h=500&fit=crop&auto=format&q=80'] },
  { keywords: ['facility', 'facilities', 'hospital', 'clinic'],                    images: ['https://images.unsplash.com/photo-1587351021355-a479a299d2f9?w=900&h=500&fit=crop&auto=format&q=80'] },
  { keywords: ['contract', 'glossary', 'employment type', 'legal'],                images: ['https://images.unsplash.com/photo-1562564055-71e051d33c19?w=900&h=500&fit=crop&auto=format&q=80'] },
  { keywords: ['us culture', 'american culture', 'cultural'],                      images: ['https://images.unsplash.com/photo-1562884328-39da45501a9c?w=900&h=500&fit=crop&auto=format&q=80'] },
];

const GENERIC_KEYWORD_COVER_IMAGES = [
  { keywords: ['welcome', 'onboarding', 'orientation', 'about honorvet', 'about the company'], images: ['https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=900&h=500&fit=crop&auto=format&q=80'] },
  { keywords: ['refresher', 'continuing education', 'renewal'],                    images: ['https://images.unsplash.com/photo-1516841273335-e39b37888115?w=900&h=500&fit=crop&auto=format&q=80'] },
];

function matchKeywordImage(list, haystack) {
  const entry = list.find(e => e.keywords.some(k => haystack.includes(k)));
  return entry ? firstUnused(entry.images) : null;
}

// Tracks which cover photos are already showing on this page load so two
// *different* courses never get the identical picture. Keyed separately by
// course id so the same course rendered twice (e.g. it appears in both
// "Freshly Brewed" and "My Courses") always gets back its own photo instead
// of being told it's "taken" by itself.
const usedCoverImages = new Set();
const resolvedCoverById = new Map();
function firstUnused(urls) {
  return (urls || []).find(u => !usedCoverImages.has(u)) || null;
}

// Resolve a course's cover photo, most specific first:
// 1) a manual per-course URL (always honoured, even if reused elsewhere),
// 2) a specific keyword match against the title/description/tags (e.g.
//    "facility" beats a broad "US Healthcare Fresher" track tag),
// 3) an exact track-tag match, 4) a generic keyword match (onboarding/
//    refresher) as a last resort, 5) null (caller falls back to
//    gradient+icon) if every relevant photo is already in use on this page.
function resolveCoverImage(course) {
  if (course.id && resolvedCoverById.has(course.id)) return resolvedCoverById.get(course.id);

  const result = (() => {
    if (course.cover_image_url) return course.cover_image_url;

    const haystack = [course.title, course.description, ...(course.tags || [])]
      .filter(Boolean).join(' ').toLowerCase();

    const specificPick = matchKeywordImage(SPECIFIC_KEYWORD_COVER_IMAGES, haystack);
    if (specificPick) return specificPick;

    const tag = (course.tags || []).find(t => TRACK_COVER_IMAGES[t]);
    const trackPick = tag ? firstUnused(TRACK_COVER_IMAGES[tag]) : null;
    if (trackPick) return trackPick;

    return matchKeywordImage(GENERIC_KEYWORD_COVER_IMAGES, haystack);
  })();

  if (result) usedCoverImages.add(result);
  if (course.id) resolvedCoverById.set(course.id, result);
  return result;
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
  const cover  = resolveCoverImage(course);
  const thumbStyle = cover
    ? `background-image:url('${cover}');background-size:cover;background-position:center`
    : `background:${courseGradient(course)}`;
  const dur    = course.duration_minutes ? `${course.duration_minutes} min` : '';
  const pct    = enr?.progress || 0;

  const progressBlock = (status === 'in_progress' || status === 'completed')
    ? `<div class="cc-prog">
         <div class="cc-prog-row"><span>Progress</span><b class="${status === 'completed' ? 'ok' : ''}">${status === 'completed' ? 'Completed' : pct + '%'}</b></div>
         <div class="cc-mini"><i class="${status === 'completed' ? 'g' : 'b'}" style="width:${status === 'completed' ? 100 : pct}%"></i></div>
       </div>`
    : '';

  return `<article class="course-card">
    <div class="cc-thumb${cover ? ' has-photo' : ''}" style="${thumbStyle}">
      ${cover ? '<div class="cc-shade"></div>' : `<span class="cc-wm">${icon}</span>`}
      <span class="cc-kind">${contentKind(course.content_type)}</span>
      ${course.is_mandatory ? '<span class="cc-mand">Mandatory</span>' : (opts.newBadge ? '<span class="cc-new">New</span>' : '')}
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

// "Freshly Brewed" — newest courses added to the catalog (real created_at data)
function freshlyBrewedHTML(courses, enrollments = [], limit = 4) {
  const fresh = [...courses]
    .filter(c => c.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
  if (!fresh.length) return '';

  return `<div class="course-grid">${fresh.map(c => {
    const enr    = enrollments.find(e => e.course_id === c.id);
    const status = enr?.status || 'not_enrolled';
    const label  = status === 'completed' ? 'Review' : status === 'in_progress' ? 'Continue' : status === 'not_started' ? 'Start' : 'View course';
    const cls    = status === 'not_enrolled' ? 'btn-secondary' : 'btn-primary';
    return courseCardHTML(c, {
      enrollment: enr, status, newBadge: true,
      actionHTML: `<a href="course.html?id=${c.id}" class="btn ${cls} btn-sm">${label}</a>`,
    });
  }).join('')}</div>`;
}

// "Recommended for you" — rule-based, no AI call needed (fast + free).
// Scores not-yet-enrolled courses by how many tags they share with courses
// this learner has completed or is actively taking; falls back to newest
// courses if nothing scores above zero (e.g. a brand-new learner).
function buildRecommendations(courses, enrollments, limit = 4) {
  const enrolledIds = new Set(enrollments.map(e => e.course_id));
  const engaged = enrollments.filter(e => e.status === 'completed' || e.status === 'in_progress');
  const profileTags = {};
  engaged.forEach(e => {
    const c = courses.find(c => c.id === e.course_id);
    (c?.tags || []).forEach(t => {
      profileTags[t] = (profileTags[t] || 0) + (e.status === 'completed' ? 2 : 1);
    });
  });

  const candidates = courses.filter(c => !enrolledIds.has(c.id));
  const scored = candidates.map(c => {
    const score = (c.tags || []).reduce((sum, t) => sum + (profileTags[t] || 0), 0);
    return { course: c, score };
  });

  scored.sort((a, b) => b.score - a.score || new Date(b.course.created_at || 0) - new Date(a.course.created_at || 0));
  return scored.slice(0, limit).map(s => s.course);
}

function recommendationsHTML(courses, enrollments, limit = 4) {
  const picks = buildRecommendations(courses, enrollments, limit);
  if (!picks.length) return '';
  return `<div class="course-grid">${picks.map(c =>
    courseCardHTML(c, { actionHTML: `<a href="course.html?id=${c.id}" class="btn btn-primary btn-sm">Start</a>` })
  ).join('')}</div>`;
}

// SVG progress ring (used by the dashboard "continue learning" hero)
function progressRing(pct, size = 132, stroke = 12) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  const cx = size / 2;
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs><linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
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

// ── AI Chat Assistant widget (floating button + panel) ──────────
let _aiChatHistory = [];
let _aiChatContext = {};
let _aiChatBusy = false;

function initAIChatWidget(context = {}) {
  _aiChatContext = context;
  if (document.getElementById('ai-chat-launcher')) return; // already mounted
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="ai-chat-launcher" class="ai-chat-launcher" onclick="toggleAIChat()" aria-label="Ask AI">
      <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    </button>
    <div id="ai-chat-panel" class="ai-chat-panel" style="display:none">
      <div class="ai-chat-head">
        <div><div class="ai-chat-title">HonorVet Academy Assistant</div><div class="ai-chat-sub">Ask about courses or how to use the platform</div></div>
        <button class="modal-close" onclick="toggleAIChat()">&times;</button>
      </div>
      <div id="ai-chat-messages" class="ai-chat-messages"></div>
      <form class="ai-chat-input-row" onsubmit="return submitAIChat(event)">
        <input class="form-input" id="ai-chat-input" placeholder="Type a question…" autocomplete="off">
        <button class="btn btn-primary btn-sm" type="submit" id="ai-chat-send">Send</button>
      </form>
    </div>`;
  document.body.appendChild(wrap);
  renderAIChatMessages();
}

function toggleAIChat() {
  const panel = document.getElementById('ai-chat-panel');
  if (!panel) return;
  const opening = panel.style.display === 'none';
  panel.style.display = opening ? '' : 'none';
  if (opening) document.getElementById('ai-chat-input')?.focus();
}

function renderAIChatMessages() {
  const el = document.getElementById('ai-chat-messages');
  if (!el) return;
  if (!_aiChatHistory.length) {
    el.innerHTML = `<div class="ai-chat-empty">👋 Hi! Ask me anything about your courses or the platform.</div>`;
  } else {
    el.innerHTML = _aiChatHistory.map(m =>
      `<div class="ai-msg ai-msg-${m.role}">${escHtml(m.content)}</div>`
    ).join('') + (_aiChatBusy ? `<div class="ai-msg ai-msg-assistant ai-msg-typing">…</div>` : '');
  }
  el.scrollTop = el.scrollHeight;
}

async function submitAIChat(e) {
  e.preventDefault();
  if (_aiChatBusy) return false;
  const input = document.getElementById('ai-chat-input');
  const question = input.value.trim();
  if (!question) return false;
  input.value = '';

  _aiChatHistory.push({ role: 'user', content: question });
  _aiChatBusy = true;
  renderAIChatMessages();

  try {
    const session = await sb().auth.getSession();
    const token   = session?.data?.session?.access_token;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token || SUPABASE_ANON}` },
      body: JSON.stringify({
        question,
        history: _aiChatHistory.slice(0, -1),
        context: _aiChatContext,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI request failed');
    _aiChatHistory.push({ role: 'assistant', content: data.answer });
  } catch (err) {
    _aiChatHistory.push({ role: 'assistant', content: `Sorry, I ran into an error: ${err.message}` });
  }
  _aiChatBusy = false;
  renderAIChatMessages();
  return false;
}

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
