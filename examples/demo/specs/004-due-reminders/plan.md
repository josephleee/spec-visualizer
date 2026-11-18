# Implementation Plan: Due Date Reminders

**Branch**: `004-due-reminders` | **Date**: 2026-05-14 | **Spec**: [spec.md](spec.md)

## Summary

A daily job on the server reads the loans due in two days and the loans that became overdue, groups them by member, and sends one message each through a small sender interface with an SMS and an email implementation. Every send is recorded, which is also what prevents a second one.

## Technical Context

**Language/Version**: TypeScript 5.9
**Primary Dependencies**: Fastify, node-cron, Nodemailer, the SMS provider's HTTP API
**Storage**: PostgreSQL 17 (`reminders` table)
**Testing**: Vitest with a recording fake sender
**Target Platform**: Linux server
**Performance Goals**: The daily job finishes in under a minute for 500 open loans
**Constraints**: Message cost under 10 euros a month; no message between 20:00 and 09:00
**Scale/Scope**: About 120 open loans on a normal week

## Constitution Check

| Principle | Status | Note |
|---|---|---|
| II. A Loan Is Never Lost | Pass | The job only reads loans |
| IV. Ask for Less | Pass | Uses the contact detail from signup, nothing new |
| V. Tests Before Shelves | Pass | The job is tested with a fake clock and a fake sender |
| VI. Plain Words | Pass | Message texts are in [quickstart.md](quickstart.md) for review |

## Project Structure

### Documentation (this feature)

```text
specs/004-due-reminders/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── reminders.openapi.yaml
```

### Source Code

```text
server/
└── reminders/
    ├── job.ts
    ├── select.ts
    ├── senders/
    │   ├── sms.ts
    │   └── email.ts
    └── routes.ts
tests/
└── reminders.test.ts
```
