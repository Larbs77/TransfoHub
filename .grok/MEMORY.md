# TransfoHub — project memory (workspace)

Last updated: 2026-07-11 (session Style-Review / v0.3.0)

**Last flush:** 2026-07-11 — full session summary in `~/.grok/memory/**/sessions/2026-07-11-flush.md`.

This file is for **agents and humans** working on TransfoHub. Grok project rules also live in `AGENTS.md` (always loaded when the project is trusted). Prefer keeping durable facts here and in `AGENTS.md`; use Grok `/remember` or `~/.grok/memory/` when experimental memory is enabled.

---

## Project identity

- **Name:** TransfoHub / PMO Transformation Bancaire  
- **Package:** `pmo-transformation-bancaire`  
- **Remote:** `https://github.com/Larbs77/TransfoHub.git`  
- **Path:** `E:\Bank-Of-Africa\TransfoHub`  
- **Version:** `0.3.0` (tag `v0.3.0`)  
- **Branch of last major work:** `Style-Review` (prior: `grok-build-branch` for Postgres migration → `v0.2.0`)

---

## Stack decisions

- PostgreSQL only (SQLite runtime removed in v0.2.0).  
- Prisma client in `generated/prisma` (gitignored).  
- Shared client factory: `lib/create-prisma.ts`; app singleton: `lib/prisma.ts` with **PRISMA_MODEL_STAMP** — bump after every schema change to avoid stale HMR clients (`Unknown field X for select`).  
- Theme: no `<script>` / no `next/script` for theme init (React 19 warning); use `ThemeProvider` + `useLayoutEffect`.  
- Avatars on disk under `public/uploads/avatars/` (gitignored); crop with `react-easy-crop`.

---

## Features shipped in v0.3.0 (this multi-session work)

### Dark mode
- Toggle under sidebar user block.  
- Key: `localStorage["pmo-theme"]` = `light` | `dark`.  
- Components: `theme-provider.tsx`, `theme-toggle.tsx`, `lib/theme-script.ts` (storage key only).

### Dynamic roles
- Model `AppRole`; pages JSON from `lib/app-pages.ts`.  
- UI: `/admin/roles`.  
- Nav uses `allowedPages`; login blocks inactive roles.  
- `requireRole` still used widely; custom roles get access via page capability mapping in `lib/auth.ts`.  
- Chantier scope: `all` | `assigned` | `none`.

### User profile fields
- `first_name`, `last_name`, `phone`, `email` on `User`.  
- Admin CRUD on `/admin/users`.

### Self-service profile `/profil`
- Click sidebar **avatar or display name** (logout button separate).  
- View data; edit phone only; change password.  
- Avatar upload → crop dialog (zoom/pan, circular) → save JPEG; delete → letter fallback.  
- Admin users table + edit dialog show avatar or letter.

### KPIs documentation
- Root file **`KPIS.txt`**: all dashboard/chantier/capacity KPI formulas.

---

## Known pitfalls

1. **Stale Prisma client in dev:** after adding columns/models, bump `PRISMA_MODEL_STAMP` and restart `npm run dev`.  
2. **Branch name:** user asked for `Style Review` → git branch is **`Style-Review`** (no spaces).  
3. **Do not reseed production data lightly:** `npm run db:seed` wipes domain tables.  
4. **Avatar files:** never commit user JPGs under `public/uploads/`.  
5. **Memory:** Expected **on** for this project. User: `~/.grok/config.toml` → `[memory] enabled = true` and/or user env `GROK_MEMORY=1`. Repo documents intent in `.grok/config.toml`. Mid-session toggle: `/memory on` (session-only). Full commands (`/flush`, `/dream`, `/memory`) need experimental memory (`GROK_MEMORY=1` or `--experimental-memory`).

---

## Suggested next work (open)

- Push `Style-Review` + tag `v0.3.0` to origin if not already.  
- Merge Style-Review into main when ready for recette.  
- Optional: map more `requireRole` call sites purely to `requirePageAccess`.  
- Optional: admin ability to clear another user's avatar.  
- Optional: cookie-based theme for zero FOUC without scripts.  
- Deploy/recette checklist against Postgres env.

---

## Key paths cheat-sheet

| Concern | Path |
|---------|------|
| Roles admin | `app/(app)/admin/roles/` |
| Users admin | `app/(app)/admin/users/` |
| Profile | `app/(app)/profil/` |
| Auth guards | `lib/auth.ts` |
| Role helpers | `lib/roles.ts`, `lib/app-pages.ts` |
| Avatar IO | `lib/avatar.ts`, `components/user-avatar.tsx`, `components/avatar-crop-dialog.tsx` |
| KPI docs | `KPIS.txt` |
| Agent rules | `AGENTS.md` |
| Grok memory config | `.grok/config.toml` |
