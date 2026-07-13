# HonorVet LMS

A lightweight Learning Management System built with pure HTML, CSS, and JavaScript. No build step. Hosted free on GitHub Pages. Data stored in Supabase (free tier).

## Live URL (after deploy)
`https://<your-github-username>.github.io/honorvet-lms`

---

## Setup in 4 steps

### Step 1 — Set up Supabase (free database)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** → give it a name → wait ~2 minutes for it to provision
3. Go to **SQL Editor** → **New query** → paste the entire contents of `supabase-setup.sql` → click **Run**
4. Go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### Step 2 — Add your Supabase keys

Open `js/config.js` and replace the two placeholder values:

```js
const SUPABASE_URL  = 'https://xxxx.supabase.co';   // ← your Project URL
const SUPABASE_ANON = 'eyJhbGci...';                 // ← your anon public key
```

> The anon key is **safe to commit** — it's a public key. Supabase's row-level security
> (already configured by the SQL above) controls what each user can actually read or write.

### Step 3 — Push to GitHub

```bash
cd honorvet-lms
git init
git add .
git commit -m "Initial commit: HonorVet LMS"
git branch -M main
git remote add origin https://github.com/<your-org>/honorvet-lms.git
git push -u origin main
```

### Step 4 — Enable GitHub Pages

1. Go to your GitHub repo → **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. That's it — the workflow in `.github/workflows/pages.yml` deploys automatically on every push to `main`
4. Your LMS will be live at `https://<your-username>.github.io/honorvet-lms` within ~1 minute

---

## Create your first admin account

1. Open your live LMS URL
2. Click **Create account** and register with your work email
3. In Supabase: **Table Editor → users** → find your row → change `role` from `employee` to `admin`
4. Sign out and back in — you now have full admin access

---

## Adding a new course

Courses are defined in `data/courses.json`. There are two ways to add one:

### Option A — Via the Admin UI (recommended)
1. Sign in as admin → **Manage Courses → + Add Course**
2. Fill in the details and click **Save Course** — this downloads an updated `courses.json`
3. Replace `data/courses.json` in your repo with the downloaded file
4. Commit and push → GitHub Pages updates automatically

### Option B — Edit the JSON directly
Open `data/courses.json` and add a new entry:

```json
{
  "id": "course-your-unique-id",
  "title": "Your Course Title",
  "description": "What employees will learn.",
  "icon": "📋",
  "content_type": "markdown",
  "content_url": "https://github.com/your-org/your-training-repo",
  "duration_minutes": 30,
  "is_mandatory": false,
  "tags": ["tag1", "tag2"]
}
```

Commit and push. The course appears instantly for all users.

### Content types

| `content_type` | `content_url` example | What users see |
|---|---|---|
| `markdown` | `https://github.com/org/repo` | README rendered as a document |
| `youtube` | `https://youtube.com/watch?v=xxx` | Embedded video player |
| `pdf` | `https://drive.google.com/file/...` | Embedded PDF viewer |
| `link` | `https://any-url.com` | Button that opens the link |

---

## Importing users

1. Admin → **Users → Import CSV**
2. Download the template, fill it in, upload
3. Each imported user gets a temporary password; they can reset it via Supabase's built-in email

CSV format:
```
name,email,role,department
John Smith,john@honorvet.com,employee,Operations
Jane Doe,jane@honorvet.com,manager,HR
```

---

## File structure

```
honorvet-lms/
├── index.html          # Login page
├── dashboard.html      # Dashboard (role-based)
├── catalog.html        # Course catalog + enroll
├── course.html         # Course player
├── users.html          # User management (admin/hr)
├── admin.html          # Course management (admin)
├── reports.html        # Reports & compliance
├── css/style.css       # All styles
├── js/
│   ├── config.js       # ← PUT YOUR SUPABASE KEYS HERE
│   ├── db.js           # Database operations
│   └── app.js          # Shared utilities & navigation
├── data/
│   └── courses.json    # ← ADD/EDIT COURSES HERE
├── supabase-setup.sql  # Run once in Supabase SQL editor
└── .github/workflows/
    └── pages.yml       # Auto-deploy to GitHub Pages
```
