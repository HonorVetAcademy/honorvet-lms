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
    // Courses are stored in data/courses.json (edit to add courses)
    if (this._cache) return this._cache;
    const res = await fetch('data/courses.json');
    if (!res.ok) return [];
    this._cache = await res.json();
    return this._cache;
  },

  async getById(id) {
    const all = await this.getAll();
    return all.find(c => c.id === id) || null;
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
    const { data, error } = await sb()
      .from('enrollments')
      .update(updates)
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async bulkAssign(courseId, userIds) {
    const rows = userIds.map(uid => ({ user_id: uid, course_id: courseId, status: 'not_started' }));
    const { data, error } = await sb()
      .from('enrollments')
      .upsert(rows, { onConflict: 'user_id,course_id' })
      .select();
    if (error) throw error;
    return data;
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
