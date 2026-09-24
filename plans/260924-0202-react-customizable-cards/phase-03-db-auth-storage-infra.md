---
phase: 3
title: DB auth storage infra
status: completed
effort: ''
---

# Phase 3: DB auth storage infra

## Overview

Drizzle schema + migrations, Postgres via `DATABASE_URL` or PGlite fallback, Better Auth (email/password, admin via `ADMIN_EMAILS`), S3/R2 storage or local-disk fallback with sharp → WebP uploads.

## Success Criteria

- [x] Sign-up/sign-in works; admin role assigned
- [x] Upload requires auth and returns a served URL
