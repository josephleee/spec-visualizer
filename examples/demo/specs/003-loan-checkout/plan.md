# Implementation Plan: Loan Checkout

**Branch**: `003-loan-checkout` | **Date**: 2026-04-10 | **Spec**: [spec.md](spec.md)

## Summary

Loans are an append-only list of events (checked out, extended, returned) written on the tablet first and replayed on the server, so two tablets that were offline never disagree about who holds a tool.

## Technical Context

**Language/Version**: TypeScript 5.9
**Primary Dependencies**: Fastify, React, Dexie, the tablet camera for barcode scans
**Storage**: PostgreSQL 17 (`loan_events`), IndexedDB outbox on the tablet
**Testing**: Vitest, Playwright with a fake camera
**Target Platform**: Android tablet (Chrome)
**Performance Goals**: Scan to confirmation under 500 ms
**Constraints**: No loan event may be dropped or applied twice

## Constitution Check

| Principle | Status | Note |
|---|---|---|
| I. The Counter Comes First | Pass | Two scans, one confirmation |
| II. A Loan Is Never Lost | Pass | Events are written before the screen confirms |
| III. Works When the Wi-Fi Does Not | Pass | Outbox on the tablet, replay on the server |

## Project Structure

```text
server/
└── loans/
    ├── events.ts
    ├── rules.ts
    └── routes.ts
app/
├── checkout/
│   ├── ScanScreen.tsx
│   └── ReturnScreen.tsx
└── offline/
    └── outbox.ts
```
