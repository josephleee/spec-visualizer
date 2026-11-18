# Implementation Plan: Member Signup

**Branch**: `001-member-signup` | **Date**: 2026-02-18 | **Spec**: [spec.md](spec.md)

## Summary

A signup form in the counter app that writes members to a local store first and syncs them to the server, with the contact detail as the key that prevents duplicates.

## Technical Context

**Language/Version**: TypeScript 5.9
**Primary Dependencies**: Fastify, React, Dexie (IndexedDB)
**Storage**: PostgreSQL 17 on the server, IndexedDB on the tablet
**Testing**: Vitest, Playwright for the counter flow
**Target Platform**: Android tablet (Chrome), Linux server
**Performance Goals**: Form submit to confirmation under 300 ms, offline included
**Constraints**: Must work with no connection for a whole opening day

## Constitution Check

| Principle | Status | Note |
|---|---|---|
| I. The Counter Comes First | Pass | Two fields and one button |
| III. Works When the Wi-Fi Does Not | Pass | Local write first, sync later |
| IV. Ask for Less | Pass | Name and one contact detail only |
| V. Tests Before Shelves | Pass | Duplicate and offline cases have tests first |

## Project Structure

```text
server/
├── members/
│   ├── routes.ts
│   └── store.ts
└── sync/
app/
├── signup/
│   ├── SignupForm.tsx
│   └── RulesStep.tsx
└── offline/
tests/
├── members.test.ts
└── signup.spec.ts
```
