---
phase: 1
title: Converter and React renderer
status: completed
effort: ''
---

# Phase 1: Converter and React renderer

## Overview

`scripts/convert-templates.mjs` turns scraped pages into `src/data/docs/*.json`; `src/components/card/*` renders them as React with LadiPage DOM/CSS intact (countdown, gallery, popup, tabs, form, wishes, music, intro gate, animations).

## Success Criteria

- [x] All 39 pages render without the LadiPage runtime
- [x] Template interactions work natively
