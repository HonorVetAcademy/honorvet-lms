// ── Supabase client (loaded from CDN in each HTML page) ───────
// Wraps all database operations with clean async functions.

let _sb = null;

function sb() {
  if (!_sb) {
    if (typeof supabase === 'undefined') throw new Error('Supabase SDK not loaded');
    _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  }
  return _sb;
}

// ── Auth ──────────────────────────────────────────────────────
const Auth = {
  async signIn(email, password) {
    const { data, error } = await sb().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signUp(email, password, meta) {
    const { data, error } = await sb().auth.signUp({ email, password, options: { data: meta } });
    if (error) throw error;
    return data;
  },
  async signOut() {
    await sb().auth.signOut();
  },
  async getSession() {
    const { data } = await sb().auth.getSession();
    return data.session;
  },
  onAuthChange(cb) {
    return sb().auth.onAuthStateChange(cb);
  },
};

// ── Users ─────────────────────────────────────────────────────
const Users = {
  async getCurrent() {
    const session = await Auth.getSession();
    if (!session) return null;
    const { data, error } = await sb()
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (error) return null;
    return data;
  },
  async getAll() {
    const { data, error } = await sb()
      .from('users')
      .select('*, enrollments(count)')
      .order('name');
    if (error) throw error;
    return data;
  },
  async upsert(id, fields) {
    const { data, error } = await sb()
      .from('users')
      .upsert({ id, ...fields }, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async updateRole(id, role) {
    const { data, error } = await sb()
      .from('users')
      .update({ role })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async importBulk(rows) {
    // rows: [{email, name, role, department}]
    // Creates auth users + user records
    const results = { success: 0, failed: [] };
    for (const row of rows) {
      try {
        const tempPassword = Math.random().toString(36).slice(2) + 'Aa1!';
        const { data: authData, error: authErr } = await sb().auth.admin
          ? await sb().auth.admin.createUser({ email: row.email, password: tempPassword, email_confirm: true })
          : { data: null, error: new Error('Admin API requires service role key') };
        if (authErr) throw authErr;
        await Users.upsert(authData.user.id, {
          email: row.email, name: row.name,
          role: row.role || 'employee',
          department: row.department || null,
        });
        results.success++;
      } catch (e) {
        results.failed.push({ email: row.email, error: e.message });
      }
    }
    return results;
  },
};

// ── Courses ───────────────────────────────────────────────────
const Courses = {
  _cache: null,

  async getAll() {
    if (this._cache) return this._cache;
    const { data, error } = await sb()
      .from('courses')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    this._cache = data || [];
    return this._cache;
  },

  async getById(id) {
    const all = await this.getAll();
    return all.find(c => c.id === id) || null;
  },

  async upsert(course) {
    const { data, error } = await sb()
      .from('courses')
      .upsert(course, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    this._cache = null;
    return data;
  },

  async remove(id) {
    const { error } = await sb()
      .from('courses')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this._cache = null;
  },

  invalidate() { this._cache = null; },
};

// ── Enrollments ───────────────────────────────────────────────
const Enrollments = {
  async getMine(userId) {
    const { data, error } = await sb()
      .from('enrollments')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },

  async getForCourse(courseId) {
    const { data, error } = await sb()
      .from('enrollments')
      .select('*, users(name, email, role, department)')
      .eq('course_id', courseId);
    if (error) throw error;
    return data || [];
  },

  async getAll() {
    const { data, error } = await sb()
      .from('enrollments')
      .select('*, users(name, email, role, department)');
    if (error) throw error;
    return data || [];
  },

  async enroll(userId, courseId) {
    const { data, error } = await sb()
      .from('enrollments')
      .upsert({ user_id: userId, course_id: courseId, status: 'not_started' }, { onConflict: 'user_id,course_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateProgress(userId, courseId, status, progress = 100) {
    const updates = { status, progress };
    if (status === 'completed') updates.completed_at = new Date().toISOString();
    const { data, error } = await sb().from('enrollments').update(updates).eq('user_id', userId).eq('course_id', courseId).select().single();
    if (error) throw error;
    if (status === 'completed') {
      try {
        const course = await Courses.getById(courseId);
        const title  = course?.title || courseId;
        await Notifications.create(userId, 'course_completed',
          `Course completed: ${title}`,
          `You successfully completed "${title}". Great work!`,
          { course_id: courseId, course_title: title });
        await Certificates.issue(userId, courseId);
        await Notifications.create(userId, 'certificate_issued',
          'Certificate earned!',
          `Your certificate for "${title}" is ready to download.`,
          { course_id: courseId, course_title: title });
      } catch(e) { console.warn('Certificate/notification error:', e.message); }
    }
    return data;
  },

  async bulkAssign(courseId, userIds) {
    const rows = userIds.map(uid => ({ user_id: uid, course_id: courseId, status: 'not_started' }));
    const { data, error } = await sb().from('enrollments').upsert(rows, { onConflict: 'user_id,course_id' }).select();
    if (error) throw error;
    try {
      const course = await Courses.getById(courseId);
      await Notifications.bulkCreate(userIds, 'course_assigned',
        `New course assigned: ${course?.title || courseId}`,
        `You have been enrolled in "${course?.title || courseId}". Log in to start learning.`,
        { course_id: courseId, course_title: course?.title || courseId });
    } catch(e) { console.warn('Notification error:', e.message); }
    return data;
  },
};

// ── Notifications ─────────────────────────────────────────────
const Notifications = {
  async getUnread(userId) {
    const { data } = await sb().from('notifications').select('*').eq('user_id', userId).eq('read', false).order('created_at', { ascending: false }).limit(20);
    return data || [];
  },
  async getAll(userId) {
    const { data } = await sb().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    return data || [];
  },
  async markAllRead(userId) {
    await sb().from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  },
  async create(userId, type, title, body, data = {}) {
    await sb().from('notifications').insert({ user_id: userId, type, title, body, data });
  },
  async bulkCreate(userIds, type, title, body, data = {}) {
    if (!userIds.length) return;
    await sb().from('notifications').insert(userIds.map(uid => ({ user_id: uid, type, title, body, data })));
  },
};

// ── Certificates ───────────────────────────────────────────────
const Certificates = {
  async issue(userId, courseId) {
    const { data, error } = await sb().from('certificates').upsert({ user_id: userId, course_id: courseId }, { onConflict: 'user_id,course_id' }).select().single();
    if (error) throw error;
    return data;
  },
  async getMine(userId) {
    const { data, error } = await sb().from('certificates').select('*, courses(title, icon)').eq('user_id', userId).order('issued_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async getAll() {
    const { data, error } = await sb().from('certificates').select('*, users(name, email), courses(title)').order('issued_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
};

// ── Learning Paths ─────────────────────────────────────────────
const LearningPaths = {
  async getAll() {
    const { data, error } = await sb().from('learning_paths').select('*, learning_path_courses(course_id, position)').order('created_at');
    if (error) throw error;
    return data || [];
  },
  async getMine(userId) {
    const { data, error } = await sb().from('path_enrollments').select('*, learning_paths(*, learning_path_courses(course_id, position))').eq('user_id', userId);
    if (error) throw error;
    return (data || []).map(pe => ({ ...pe.learning_paths, assigned_at: pe.assigned_at }));
  },
  async upsert(path) {
    const { data, error } = await sb().from('learning_paths').upsert(path, { onConflict: 'id' }).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await sb().from('learning_paths').delete().eq('id', id);
    if (error) throw error;
  },
  async setCourses(pathId, courseIds) {
    await sb().from('learning_path_courses').delete().eq('path_id', pathId);
    if (!courseIds.length) return;
    const { error } = await sb().from('learning_path_courses').insert(courseIds.map((id, i) => ({ path_id: pathId, course_id: id, position: i })));
    if (error) throw error;
  },
  async assign(pathId, userIds) {
    if (!userIds.length) return;
    const { error } = await sb().from('path_enrollments').upsert(userIds.map(uid => ({ user_id: uid, path_id: pathId })), { onConflict: 'user_id,path_id' });
    if (error) throw error;
    // Enroll users in all courses in the path, and notify
    const paths = await LearningPaths.getAll();
    const path = paths.find(p => p.id === pathId);
    if (path?.learning_path_courses?.length) {
      for (const pc of path.learning_path_courses) {
        const rows = userIds.map(uid => ({ user_id: uid, course_id: pc.course_id, status: 'not_started' }));
        await sb().from('enrollments').upsert(rows, { onConflict: 'user_id,course_id' });
      }
    }
    await Notifications.bulkCreate(userIds, 'path_assigned', 'Learning path assigned',
      `You have been enrolled in the learning path: "${path?.title || pathId}"`, { path_id: pathId });
  },
};

// ── Reports ───────────────────────────────────────────────────
const Reports = {
  async getOverview() {
    const [enrollments, users, courses] = await Promise.all([
      Enrollments.getAll(),
      Users.getAll(),
      Courses.getAll(),
    ]);
    const completed  = enrollments.filter(e => e.status === 'completed').length;
    const inProgress = enrollments.filter(e => e.status === 'in_progress').length;
    const mandatory  = courses.filter(c => c.is_mandatory);
    const mandatoryEnrollments = enrollments.filter(e => mandatory.some(m => m.id === e.course_id));
    const complianceRate = mandatoryEnrollments.length
      ? Math.round(mandatoryEnrollments.filter(e => e.status === 'completed').length / mandatoryEnrollments.length * 100)
      : 100;
    return { totalUsers: users.length, totalCourses: courses.length, completed, inProgress, complianceRate };
  },

  async getCompletionByUser() {
    const [enrollments, courses] = await Promise.all([Enrollments.getAll(), Courses.getAll()]);
    const byUser = {};
    for (const e of enrollments) {
      const uid = e.user_id;
      if (!byUser[uid]) byUser[uid] = { user: e.users, total: 0, completed: 0 };
      byUser[uid].total++;
      if (e.status === 'completed') byUser[uid].completed++;
    }
    return Object.values(byUser).map(u => ({
      ...u,
      percent: u.total ? Math.round(u.completed / u.total * 100) : 0,
    })).sort((a, b) => b.percent - a.percent);
  },
};
