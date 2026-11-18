# Implementation Plan: Tool Catalog

**Branch**: `002-tool-catalog` | **Date**: 2026-03-05 | **Spec**: [spec.md](spec.md)

## Summary

Tools and their copies live in PostgreSQL; the counter tablet keeps a full copy of the catalog and searches it locally, so search works offline and stays under a second.

## Technical Context

**Language/Version**: TypeScript 5.9
**Primary Dependencies**: Fastify, React, MiniSearch
**Storage**: PostgreSQL 17, photos on the server disk, catalog mirror in IndexedDB
**Testing**: Vitest, Playwright
**Target Platform**: Android tablet (Chrome), members' phones
**Performance Goals**: Search results in under 1 s for 2,000 tools
**Constraints**: Catalog mirror under 20 MB, photos included
**Scale/Scope**: About 600 tools today, 2,000 within three years

## Constitution Check

| Principle | Status | Note |
|---|---|---|
| I. The Counter Comes First | Pass | Search is the first screen of the counter app |
| II. A Loan Is Never Lost | Pass | Retiring a tool hides it, history stays |
| III. Works When the Wi-Fi Does Not | Pass | Search runs on the local mirror |
| VI. Plain Words | Pass | "Copy" is shown as "item 2 of 3" |

## Project Structure

```text
server/
├── catalog/
│   ├── routes.ts
│   ├── store.ts
│   └── photos.ts
app/
├── catalog/
│   ├── SearchScreen.tsx
│   ├── ToolForm.tsx
│   └── CategoryList.tsx
└── offline/
    └── catalogMirror.ts
tests/
├── catalog.test.ts
└── search.spec.ts
```

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| A second copy of the catalog on the tablet | Search must work offline | Server-only search fails in the basement |
