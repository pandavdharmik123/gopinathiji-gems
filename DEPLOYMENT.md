# Production Deployment Guide

This document covers the safe release flow for the Gopinathji Gems backend and frontend.

> **Never run `prisma db push` against production.** Schema changes are applied with versioned Prisma migrations. The production build no longer touches the database.

## Already on Render + Vercel?

1. **Back up** the Render database.
2. **Pause auto-deploy** on Render.
3. From your local `server/` folder, run once against the Render **external** database URL: `npm run db:preflight && npm run db:baseline` (see section 5).
4. Set Render's **Pre-Deploy Command** to `npm run release`, then push/resume auto-deploy.
5. On Vercel, set `VITE_API_LINK=https://<your-api>.onrender.com/api` and redeploy (see section 6).
6. Set the backend's `CORS_ORIGIN` to the Vercel domain and redeploy the API.
7. Disable the self keep-alive and move backups to GitHub Actions to cut Render hours (see section 7).

Sections 5–7 cover the exact settings.

---

## 1. Components

| Component | Suggested host | Notes |
|---|---|---|
| Frontend (`dist/`) | Vercel / static host | `vercel.json` rewrites all paths to `index.html` |
| API (`server/`) | Render / Railway / VPS | Node 22, PostgreSQL 16 |
| Database | Managed PostgreSQL | Automated backups required |

---

## 2. Required environment variables

### Backend (`server/`)

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/gopinathji_gems
PORT=3001
JWT_SECRET=<64-byte random hex>
JWT_EXPIRES_IN=2h
CORS_ORIGIN=https://your-frontend-domain.com
BCRYPT_ROUNDS=12

# Optional but recommended
SERVER_URL=https://your-api-domain.com
GOOGLE_DRIVE_BACKUP_ENABLED=true
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_REFRESH_TOKEN=...
GOOGLE_DRIVE_BACKUP_FOLDER_ID=...
DB_BACKUP_ENCRYPTION_KEY=<at least 32 characters>
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Frontend

```env
VITE_API_LINK=https://your-api-domain.com/api
```

Do not commit real `.env` files. Rotate any secret that has ever been committed or shared.

---

## 3. One-time baseline for an existing database

If the production database already has the application tables (created previously with `prisma db push`), Prisma needs to mark the baseline migration as already applied.

**Take a verified database backup first.**

```bash
cd server

# 1. Check for rows that would block the new constraints
DATABASE_URL="postgresql://..." npm run db:preflight

# 2. Mark the initial (pre-existing) schema as already present
DATABASE_URL="postgresql://..." npm run db:baseline

# 3. Apply the remaining migrations:
#    20261110000050_new_tables  -> backup_runs + voucher_counters
#    20261110000100_constraints -> CHECK / partial-unique / exclusion constraints
DATABASE_URL="postgresql://..." npm run release
```

`db:baseline` only records migration history — it does not alter tables. Skip it for a brand-new/empty database.

> **Order matters.** `db:baseline` must run against the existing database **before** the first `release`/auto-deploy. If `prisma migrate deploy` runs first, the baseline migration tries to create tables that already exist and the deploy fails.

### Pre-flight blockers

`db:preflight` fails if production contains:

- transactions with `amount <= 0`
- duplicate voucher numbers
- accounting years with `endDate <= startDate`
- more than one active accounting year
- overlapping accounting-year ranges

Fix those rows, re-run the preflight, then release.

---

## 4. Standard release flow

For a new/empty database or after the one-time baseline:

```bash
cd server
npm ci
npm run release          # preflight + prisma migrate deploy
npx prisma generate
npm run build            # generates client + compiles TypeScript
npm start
```

`npm run release` is safe to run repeatedly: migrations are tracked in `_prisma_migrations`, and the constraint migration is idempotent.

### What changed

- `npm run build` is now `prisma generate && tsc` — it **does not** modify the database.
- `npm run release` is `db:preflight && prisma migrate deploy`.
- Migrations live in `server/prisma/migrations/` and apply in order:
  1. `baseline` — the schema that already exists in production (8 tables)
  2. `new_tables` — adds `backup_runs` and `voucher_counters` (idempotent, so it also works if `db push` already created them)
  3. `constraints` — CHECK, partial-unique, and exclusion constraints
- Custom SQL invariants live in `server/prisma/sql/constraints.sql` and are mirrored in the constraints migration.

---

## 5. Render: automatic deploy pipeline

Your Render service will keep auto-deploying on every push, **but the database release step must be part of the deploy**. The build command no longer mutates the database, so configure Render like this:

### Service settings (backend)

| Setting | Value |
|---|---|
| Root Directory | `server` |
| Build Command | `npm ci --include=dev && npm run build` |
| Pre-Deploy Command | `npm run release` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

`npm run release` runs the pre-flight checks and `prisma migrate deploy` against `DATABASE_URL` from your Render environment. It aborts the deploy if the pre-flight finds bad rows, so the old version keeps running.

> If your Render plan does not offer **Pre-Deploy Command**, use `npm run release && npm start` as the Start Command instead. Only do this with **one** instance — multiple instances starting simultaneously can race on migrations.

`--include=dev` is required: `prisma`, `ts-node` (used by `db:preflight`), and `tsc` are dev dependencies. If `NODE_ENV=production` is set on the Render service, a plain `npm ci` would skip them and the build/release would fail.

> If your Render service uses the repository root instead of `server`, prefix each command with `cd server &&` (e.g. `cd server && npm run release`).

### One-time step for your existing Render database

Your current database was created with `prisma db push` and has no migration history. Do this **once**, before the first deploy that runs `npm run release`.

> The Render Shell runs the code of the *currently deployed* instance. Until the new code is deployed it does not contain the new scripts, so run the baseline from your local checkout against the **external** database URL.

1. **Back up** the database (Render → database → Backups/Snapshot).
2. **Pause auto-deploy** on the backend service (Settings → Auto-Deploy: off).
3. From your local `server/` folder, point at the Render **External Database URL** and run:

   ```bash
   cd server
   npm ci --include=dev

   export DATABASE_URL="postgresql://...external.../gopinathji_gems?sslmode=require"
   npm run db:preflight   # must pass
   npm run db:baseline    # records the existing schema as applied
   ```

4. Configure the service settings from the table above (build, pre-deploy, start, health check).
5. Commit/push the changes and resume auto-deploy (or click **Manual Deploy**). The pre-deploy runs `npm run release`, which applies `new_tables` and `constraints`.
6. Run the post-deploy smoke test.

After that, every push runs `release` automatically and applies only new migrations.

**Without the one-time baseline**, the first auto-deploy fails while trying to create tables that already exist. **Without the pre-deploy command**, pushes deploy code but never apply the new `backup_runs`/`voucher_counters` tables or constraints — backup and transaction creation would break.

> Do not use the Render Shell for the baseline until the new code is live. If you must use it, deploy first with the pre-deploy command **empty**, run `npm run db:baseline && npm run release` in the Shell, then add the pre-deploy command. This leaves a short window where the new tables are missing.

### Render environment variables to double-check

```env
DATABASE_URL=<Render internal connection string>
NODE_ENV=production
JWT_SECRET=<64-byte random hex>
CORS_ORIGIN=https://your-app.vercel.app
SERVER_URL=https://your-api.onrender.com
RENDER_EXTERNAL_URL=https://your-api.onrender.com
# Keep the free instance asleep when idle (see section 7)
KEEP_ALIVE_ENABLED=false
# Backups are handled by GitHub Actions (see section 7)
GOOGLE_DRIVE_BACKUP_ENABLED=false
```

---

## 6. Vercel: frontend

The frontend will work unchanged. `vercel.json` already rewrites every path to `index.html`, so the new 404 route and client-side routing work on refresh and deep links.

### Vercel project settings

| Setting | Value |
|---|---|
| Framework Preset | Vite |
| Root Directory | repository root |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci --include=dev` |

### Required environment variable

```env
VITE_API_LINK=https://your-api.onrender.com/api
```

`VITE_` variables are baked in at build time, so **redeploy after changing it**.

### Recommended build-only variable

```env
ELECTRON_SKIP_BINARY_DOWNLOAD=1
```

The repo carries Electron for the desktop build. Skipping its binary download keeps Vercel installs fast and avoids a large optional download. It does not affect the web build.

`--include=dev` keeps Vite/TypeScript available during the Vercel build even if `NODE_ENV=production` is set.

### CORS

Set the backend's `CORS_ORIGIN` to the exact frontend origin(s). Multiple origins are comma-separated:

```env
CORS_ORIGIN=https://your-app.vercel.app,https://your-app-git-main.vercel.app
```

Preview deployments get a new URL on every push. Either add those URLs to `CORS_ORIGIN` or use Vercel's stable production domain for day-to-day use.

### Checklist for Vercel

- [ ] `VITE_API_LINK` ends with `/api` and points at the Render URL.
- [ ] Backend `CORS_ORIGIN` includes the exact Vercel origin (scheme + host, no trailing slash).
- [ ] Login works from the deployed frontend.
- [ ] Refreshing a deep link (e.g. `/reports`) does not 404.
- [ ] Network tab shows API requests going to the Render domain, not localhost.

---

## 7. Reducing Render instance hours

Render's free allowance is **750 instance-hours per workspace per month**, shared by every free service. If another service runs 24/7, it consumes roughly 720–744 hours, leaving very little for this app. Two repo changes keep this service asleep except when someone is actually using it:

### 7.1 Self keep-alive is now off by default

`server/src/lib/keepAlive.ts` used to ping its own `/health` every 5 minutes forever, which kept the instance running 24/7. It now requires an explicit opt-in:

```env
KEEP_ALIVE_ENABLED=false
```

Leave it `false` on Render. An always-on instance would consume the whole allowance by itself. The trade-off is a ~30–60s cold start on the first request after 15 minutes of inactivity.

### 7.2 Backups run on GitHub Actions, not Render

`.github/workflows/backup.yml` runs the existing CLI backup (`npm run backup`) against the production database on GitHub's runners. It performs `pg_dump`, optional encryption, Google Drive upload, and retention, then exits. **The Render web service never wakes up for backups** — zero instance-hours.

It runs daily at **20:30 UTC = 02:00 Asia/Kolkata**. You can also run it manually from **Actions → Google Drive backup → Run workflow**; set `dry_run` to test `pg_dump` without uploading.

On Render, disable the in-process scheduler to avoid duplicate backups when the service happens to be awake:

```env
GOOGLE_DRIVE_BACKUP_ENABLED=false
```

Manual backups from the app UI still work; that flag only controls the cron scheduler.

Once the GitHub Actions backup is verified, you can **remove the Google Drive credentials from Render entirely**. They are only needed by the app process for manual Drive backups, the Drive status/browse APIs, and the in-process scheduler. The GitHub workflow uses its own repository secrets.

| Runtime feature | Needs Drive credentials on Render? |
|---|---|
| Scheduled backup (GitHub Actions) | ❌ No — uses GitHub secrets |
| Manual “backup now” via API/UI | ✅ Yes |
| Drive file listing/status APIs | ✅ Yes |
| Excel export / preview / restore | ❌ No — no Drive access |
| `backup_runs` history | ❌ No — reads the database |

If you remove them, those manual Drive endpoints return `503 Google Drive backup is not configured`. Nothing in the web UI calls them, so the app keeps working normally. Use the GitHub **Run workflow** button when you need an on-demand backup.

Keep `DB_BACKUP_ENCRYPTION_KEY` (if you use encrypted backups) in a password manager and in GitHub secrets: encrypted `.dump.enc` files cannot be restored without it.

### 7.3 GitHub repository secrets and variables

Add these under **Settings → Secrets and variables → Actions**:

| Secret | Required | Value |
|---|---|---|
| `PROD_DATABASE_URL` | yes | Render **External** Database URL, including `?sslmode=require` |
| `GOOGLE_DRIVE_CLIENT_ID` | yes | same value as Render |
| `GOOGLE_DRIVE_CLIENT_SECRET` | yes | same value as Render |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | yes | same value as Render |
| `GOOGLE_DRIVE_ACCOUNT_EMAIL` | recommended | expected Drive account |
| `GOOGLE_DRIVE_BACKUP_FOLDER_ID` | optional | existing Drive folder ID |
| `DB_BACKUP_ENCRYPTION_KEY` | optional | 32+ characters |

Optional repository **variable**:

| Variable | Value |
|---|---|
| `BACKUP_PROJECT_NAME` | filename prefix, e.g. `advocate-management` |

Unset secrets are exposed as empty strings by GitHub Actions; the backup config now treats empty values as "not set", so optional secrets can be left blank.

### 7.4 Caveats

- **GitHub schedules are UTC and best-effort.** A run can be delayed by a few minutes during peak load. That is fine for a daily backup.
- **Scheduled workflows are disabled after 60 days of repository inactivity.** Any push or a manual run re-enables them. If the repo is quiet, add a monthly commit or manually run the workflow.
- **`pg_dump` version:** `pg_dump` must match the server's major version. `ubuntu-latest` ships PostgreSQL 16, but Supabase runs 17.x, so the workflow installs `postgresql-client-17` from the PGDG repository and puts it first on `PATH`. If you upgrade the database to 18+, bump the client version in `.github/workflows/backup.yml`.
- **External database access:** the workflow needs the Render *external* URL, not the internal one. Keep it in a secret; it contains database credentials.
- **Cold starts:** the first daytime request after idle takes ~30–60s. If that is unacceptable, you can add an external warm-up window (cron-job.org) during business hours, but it consumes instance-hours.

### 7.5 Verify after the first run

1. GitHub **Actions → Google Drive backup** shows a green run.
2. The `.dump` (or `.enc`) file appears in the Drive folder.
3. In the app (admin) or the database, the latest `backup_runs` row is `SUCCESS`.
4. Render **Events/Logs** show the service spinning down after ~15 idle minutes.
5. Next morning, confirm another backup landed.

---

## 8. Pre-deploy checklist

- [ ] Verified database backup exists and was restored successfully on a staging copy.
- [ ] `npm run db:preflight` passes against the production database.
- [ ] `NODE_ENV=production`, strong `JWT_SECRET`, exact `CORS_ORIGIN`.
- [ ] `VITE_API_LINK` points at the production API.
- [ ] Google Drive backup credentials and encryption key configured (if used).
- [ ] Password hashes rotated if the pre-fix backup endpoints were ever exposed externally.
- [ ] CI is green on the commit being deployed (`.github/workflows/ci.yml`).
- [ ] Rollback plan confirmed (see section 10).

---

## 9. Post-deploy smoke test

1. `GET /health` returns `200`.
2. Admin can log in; invalid login returns `401`.
3. Dashboard loads with transactions and no “Backend data load failed”.
4. Create/edit/delete a transaction; voucher number is unique.
5. Employee cannot open `/users`, `/settings`, `/audit`, `/reports`, or `/transactions`.
6. Reports load and PDF export works.
7. Excel backup exports; preview works.
8. Restore works **on staging only** — never test a destructive restore on production.
9. Check server logs for 5xx responses and audit entries.

---

## 10. Rollback

Migrations are forward-only.

1. Stop the API.
2. Restore the pre-deploy database backup.
3. Redeploy the previous application build.
4. If the migration history must be corrected, use `prisma migrate resolve --rolled-back <migration_name>` only after restoring the matching schema.

Keep the previous release artifact available until the smoke test passes.

---

## 11. CI pipeline

`.github/workflows/ci.yml` runs on pushes and pull requests:

1. Starts PostgreSQL 16.
2. Installs frontend and server dependencies.
3. Applies migrations with `npm run release`.
4. Seeds the isolated QA database.
5. Runs server type-check and 96 API tests.
6. Fails on high/critical server advisories.
7. Runs frontend type-check and 22 unit tests.
8. Builds the production bundle.
9. Runs the 13 Playwright E2E tests.
10. Uploads Playwright artifacts on failure.

The E2E config is path-relative and reads `QA_DATABASE_URL`, so it runs both locally and in CI.
