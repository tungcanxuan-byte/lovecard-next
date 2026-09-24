@AGENTS.md

# LoveCard Next

LoveCard's LadiPage wedding-card templates (lovecard.click), rebuilt as native React, plus a card builder where users create, edit and publish their own cards. The user is a LoveCard partner and allowed reuse of its HTML/CSS/images/music.

## Pipeline
- `scripts/scrape-templates.mjs [slug...]` mirrors pages and assets into `src/data/templates/<slug>.json` + `public/assets/`.
- `scripts/convert-templates.mjs` turns those into `src/data/docs/<slug>.json` (CSS, compact DOM tree, `elements` by LadiPage id, `features`, `sections`, `photos`); field bindings live in `src/data/template-fields/`. Edit the scripts and re-run them; don't hand-edit generated JSON or `public/assets`.
- `src/components/card/*` renders a doc as React, keeping LadiPage's DOM/classes so template CSS applies. `src/lib/card/resolve.ts` applies card content (quick fields, per-element overrides, colours, section order, event date) over template defaults.
- `/[slug]` = template demos (SSG, default couple). `/thiep/[slug]` = user cards (drafts visible to owner/admin only). Editor = `/tai-khoan/thiep/[id]`, which hosts the canvas iframe `/khung/[id]` over same-origin postMessage (`src/components/editor/protocol.ts`).
- Default couple/photos: `DEFAULT_FIELDS` / `DEFAULT_PHOTOS` in `resolve.ts`. Photos live in `public/defaults/photos/` (gitignored personal photos).
- Brand (site name "WeddingCard", domain, default bank + QR, default contacts) lives in `src/data/brand.json`. The converter swaps LoveCard's name/domain/hotline/QR codes for it and tags contact elements (`contact`); `applyContacts` in `resolve.ts` fills them from admin settings (`/admin?tab=settings`, `src/lib/settings.ts`), hiding empty ones. New LoveCard brand strings or sample QR files → extend `REBRAND`/`QR_RE` in the converter.

## Backend
- Drizzle schema `src/lib/db/schema.ts`; migrations in `drizzle/` (`pnpm db:generate`, `pnpm db:migrate`).
- No `DATABASE_URL` → PGlite at `.data/pglite` (auto-migrated). No `S3_*` → uploads in `.data/uploads`, served by `/uploads/[...key]`. See `.env.example`.
- Better Auth (`src/lib/auth/server.ts`), built lazily; `ADMIN_EMAILS` get role `admin` at sign-up. Admins activate cards (no payments).
- Card content is validated/sanitized in `src/lib/cards.ts` (zod + sanitize-html); keep new content fields there.

## Gotchas
- Reading `node_modules` is blocked by a hook; don't work around it.
- React Compiler lint: pass refs via JSX (`<Tag ref={...}>`), not `createElement` props or context objects; names ending in `Ref` are treated as refs.
- Call `headers()`/`getUser()` before `getAuth()` in pages, or Next tries to prerender them.
- Templates on other domains (nawngs.com, ewedinvite.site, ...) are out of scope until ownership is confirmed.
