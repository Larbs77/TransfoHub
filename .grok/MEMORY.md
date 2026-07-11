# TransfoHub — project memory (workspace)

Last updated: 2026-07-11 (branch `SMTP-Server-Connection` / v0.3.1 on `main`)

This file is for **agents and humans** working on TransfoHub. Grok project rules also live in `AGENTS.md` (always loaded when the project is trusted). Prefer keeping durable facts here and in `AGENTS.md`.

---

## Project identity

- **Name:** TransfoHub / PMO Transformation Bancaire  
- **Package:** `pmo-transformation-bancaire`  
- **Remote:** `https://github.com/Larbs77/TransfoHub.git`  
- **Path:** `E:\Bank-Of-Africa\TransfoHub`  
- **Version:** `0.3.1` (tag `v0.3.1`)  
- **main tip:** `f07c5a0` — includes full Style-Review + BOA branding (fast-forward merged)  
- **Current branch:** **`SMTP-Server-Connection`** (branched from `main` for SMTP server connection work)  
- **Prior branches:** `Style-Review` (v0.3.x UI/features), `grok-build-branch` / postgres migration → `v0.2.0`

---

## Brand (Bank of Africa)

| Color | Hex | Role |
|-------|-----|------|
| Navy | `#0A3C74` | Primary, text, buttons, nav active |
| Teal | `#00BDBB` | Accents, focus, brand labels |
| White | — | Dominant surfaces (auth + light app) |

- Logo file: `public/boa-logo.png` (copied from user desktop `BANKOFAFRICA-LOGOO_0.png`)  
- Auth shell: `components/auth-brand-shell.tsx` + CSS in `app/globals.css` (`.auth-*`)  
- Login layout: logo on top; Sparkles icon left of **TransfoHub** title  
- Light mode app tokens in `:root` of `globals.css`; soft teal/navy page wash  
- Timeline bar colors: `TIMELINE_PRIORITE_COLORS` in `lib/chantier-labels.ts` (not the rainbow `PRIORITE_CHANTIER_COLORS`)

---

## Stack decisions

- PostgreSQL only (SQLite runtime removed in v0.2.0).  
- Prisma client in `generated/prisma` (gitignored).  
- Shared client factory: `lib/create-prisma.ts`; app singleton: `lib/prisma.ts` with **PRISMA_MODEL_STAMP** — current stamp includes `user-theme-pref-v2`; bump after every schema change.  
- Theme: no `<script>` / no `next/script` for theme init (React 19 warning); use `ThemeProvider` + `useLayoutEffect`.  
- Avatars on disk under `public/uploads/avatars/` (gitignored); crop with `react-easy-crop`.

---

## Features through v0.3.1

### Theme
- Sidebar toggle = temporary device/session switch (`localStorage["pmo-theme"]`).  
- Account default: `User.theme_preference` (`light` | `dark`) set on `/profil` « Mode d'affichage ».  
- Applied on authenticated load via `UserThemeSync` in `app/(app)/layout.tsx`.  
- Light mode branded navy/teal; dark mode separate `.dark` palette.

### Dynamic roles / users / profil
- `AppRole`, `/admin/roles`, page JSON, chantier_scope.  
- Profile fields + avatars + `/profil` self-service.  
- See `AGENTS.md` for full permission model.

### Home KPIs
- First card label **« Lancés / total »**: N = statut ≠ « Non démarré », T = all chantiers.  
- Subtitle: « Chantiers démarrés ».  
- KPI card hover lift + bold titles.  
- Docs: `KPIS.txt`.

### Timeline Chantiers
- Bars: BOA navy→teal (`TIMELINE_PRIORITE_COLORS`).  
- Date ticks: January sky / July amber (unchanged by BOA bar palette).  
- Today: rose vertical line + small **Auj.** under the date row.  
- Components: `dashboard-charts.tsx` (`ChantierTimelineChart`), `chantier-timeline-pmo.tsx`.

### Auth UX
- Login + change-password use `AuthBrandShell`.  
- BOA logo + TransfoHub + Sparkles icon.

---

## Prisma migrations (Postgres era)

1. `20260710172723_init_postgres`  
2. `…_add_app_roles`  
3. `…_add_user_profile_fields`  
4. `…_add_user_avatar`  
5. `…_add_user_theme_preference` (`theme_preference` on User)

---

## Known pitfalls

1. **Stale Prisma client in dev:** after adding columns/models, bump `PRISMA_MODEL_STAMP` and restart `npm run dev`.  
2. **Branch name:** historical « Style Review » → git branch **`Style-Review`**.  
3. **Do not reseed production data lightly:** `npm run db:seed` wipes domain tables.  
4. **Avatar files:** never commit user JPGs under `public/uploads/`.  
5. **Memory:** Expected **on**. User: `~/.grok/config.toml` → `[memory] enabled = true` and/or `GROK_MEMORY=1`. Mid-session: `/memory on`.  
6. **Push status:** local `main` was ahead of `origin/main` after v0.3.1 merge; push main + tags if not done.  
7. **Timeline colors:** do not change `PRIORITE_CHANTIER_COLORS` for the Gantt — use `TIMELINE_PRIORITE_COLORS` only for timeline bars.

---

## Suggested next work (open)

- **SMTP server connection** on branch `SMTP-Server-Connection` (current focus).  
- Push `main` + `v0.3.1` to origin if not already.  
- Optional: map more `requireRole` call sites to `requirePageAccess`.  
- Optional: admin ability to clear another user's avatar.  
- Optional: cookie-based theme for zero FOUC without scripts.  
- Deploy/recette checklist against Postgres env.

---

## Key paths cheat-sheet

| Concern | Path |
|---------|------|
| Agent rules | `AGENTS.md` |
| This memory | `.grok/MEMORY.md` |
| Auth shell / login brand | `components/auth-brand-shell.tsx`, `app/(auth)/login/` |
| BOA logo | `public/boa-logo.png` |
| Light theme tokens | `app/globals.css` `:root` |
| Theme sync | `components/user-theme-sync.tsx`, `components/theme-provider.tsx` |
| Profile + theme pref | `app/(app)/profil/` |
| KPI cards | `components/kpi-cards.tsx` |
| Timeline | `components/dashboard-charts.tsx`, `components/chantier-timeline-pmo.tsx` |
| Timeline BOA colors | `lib/chantier-labels.ts` → `TIMELINE_PRIORITE_COLORS` |
| Roles admin | `app/(app)/admin/roles/` |
| Users admin | `app/(app)/admin/users/` |
| Auth guards | `lib/auth.ts` |
| KPI docs | `KPIS.txt` |
