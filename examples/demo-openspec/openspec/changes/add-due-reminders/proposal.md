# Proposal: Add due reminders

## Why

Most late fees are for tools people simply forgot. A message two days before the due date would save members the fee and the library the chasing.

## What Changes

- A reminder by e-mail or text message two days before a loan is due.
- Members can turn reminders off on their account page.
- **BREAKING** for volunteers: the nightly overdue list moves from paper to the counter page.

## Capabilities

### Modified Capabilities
- `loans`: reminders before the due date; returns stop them.

## Impact

- A daily job on the library server; an SMS provider account; the member account page.
