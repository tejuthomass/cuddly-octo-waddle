# Facility CMMS

React + Vite + TypeScript frontend with Supabase (Postgres/Auth/Edge Functions).

## 1) One-time prerequisites

- Node.js 20+
- npm 10+
- A Supabase project
- Supabase CLI (optional globally, can use `npx supabase@latest`)

## 2) First-time setup

### A. Clone and install

```bash
git clone <your-repo-url>
cd cuddly-octo-waddle
npm install
```

### B. Configure frontend env

Create `.env.local` in project root:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### C. Apply database migrations

```bash
npx supabase@latest link --project-ref <project-ref>
npx supabase@latest db push
```

This applies:

- `supabase/migrations/001_init_schema.sql`
- `supabase/migrations/002_fix_set_updated_at_search_path.sql`
- `supabase/migrations/003_super_admin_guards.sql`
- `supabase/migrations/004_admin_domain_foundation.sql`
- `supabase/migrations/005_employee_id_login.sql`
- `supabase/migrations/006_backfill_role_assignments.sql`
- `supabase/migrations/007_generic_user_id.sql`

### D. Set Edge Function secrets

```bash
npx supabase@latest secrets set SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### E. Deploy Edge Function

```bash
npx supabase@latest functions deploy admin-create-user --no-verify-jwt
npx supabase@latest functions deploy admin-delete-user --no-verify-jwt
npx supabase@latest functions deploy admin-update-user --no-verify-jwt
```

## 3) Run locally

```bash
npm run dev
```

Optional checks:

```bash
npm run lint
npm run build
```

## 4) If you clone again tomorrow (resume steps)

From a fresh machine/session:

1. `git clone <your-repo-url>`
2. `cd cuddly-octo-waddle`
3. `npm install`
4. Recreate `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
5. `npx supabase@latest link --project-ref <project-ref>`
6. `npx supabase@latest db push` (safe; only unapplied migrations run)
7. `npx supabase@latest functions deploy admin-create-user --no-verify-jwt` (only needed if function changed)
8. `npx supabase@latest functions deploy admin-delete-user --no-verify-jwt` (only needed if function changed)
9. `npx supabase@latest functions deploy admin-update-user --no-verify-jwt` (only needed if function changed)
10. `npm run dev`

If `npx supabase@latest` asks to install, confirm with `y`.

## 5) Super Admin model (current)

- Exactly one active `l5_admin` role is allowed globally.
- Super Admin role cannot be disabled or deleted.
- Super Admin user cannot be deactivated.
- In UI top bar, Super Admin does not get the client switch dropdown.
