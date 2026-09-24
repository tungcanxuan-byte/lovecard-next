---
title: Native React card templates + customizable cards
description: ''
status: completed
priority: P1
branch: main
tags: []
blockedBy: []
blocks: []
created: '2026-09-23T19:05:04.835Z'
createdBy: 'ck:plan'
source: skill
---

# Native React card templates + customizable cards

## Overview

Replace LadiPage runtime with native React rendering for all 39 pages, then build customer/admin card
creation on top. Decisions (user, 2026-09-24): converter + shared renderer; quick-info form + inline
edit; Better Auth + Postgres (Neon later) + Drizzle + S3/R2 (later); no payments (admin activates).
Default content: PAXT photos (~/Downloads/PAXT) in photo slots, couple Trần Thị Phương Anh (bride) &
Cấn Xuân Tùng (groom).

## Key design
- `scripts/convert-templates.mjs`: scraped JSON → `src/data/docs/<slug>.json` = { css, tree (compact
  AST of `.ladi-wraper` + popups), elements (id → type, defaults: text/image/gallery/actions/animation/
  countdown/form), features (music, guestName, falling, introGate, antiCopy, wishes) }.
- Renderer (`src/components/card/*`): AST → React elements, keeping the exact LadiPage DOM so template
  CSS applies; typed components for countdown/gallery/popup/tabs/form/wishes/music; overrides by id.
- Card = { templateSlug, content: { fields, overrides{id:{text,image,gallery,hidden,style}}, music,
  eventAt } } stored in Postgres. No DATABASE_URL → PGlite at `.data/pglite`. No S3 env → `public/uploads`.
- Photo slot = IMAGE with .jpg/.jpeg bg ≥ 60px, or gallery item. Decorations kept.

## Out of scope
Payments, drag-drop layout editing, other-domain templates.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Converter and React renderer](./phase-01-converter-and-react-renderer.md) | Completed |
| 2 | [Default content PAXT and couple](./phase-02-default-content-paxt-and-couple.md) | Completed |
| 3 | [DB auth storage infra](./phase-03-db-auth-storage-infra.md) | Completed |
| 4 | [Card editor dashboard public page wishes](./phase-04-card-editor-dashboard-public-page-wishes.md) | Completed |
| 5 | [Admin](./phase-05-admin.md) | Completed |
| 6 | [Verify lint build docs](./phase-06-verify-lint-build-docs.md) | Completed |

## Dependencies

<!-- Cross-plan dependencies -->
