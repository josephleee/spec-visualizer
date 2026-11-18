# Borrowbox Constitution

## Core Principles

### I. The Counter Comes First

Every feature must work for a volunteer standing at the counter with a queue in front of them. A lending step that takes more than three taps, or needs a manual to explain, is not finished.

### II. A Loan Is Never Lost

The record of who holds which tool is the one thing the library cannot rebuild from memory. Every change to a loan is written before it is confirmed on screen, and no feature may delete loan history.

### III. Works When the Wi-Fi Does Not

The library sits in a basement. Checkout and return must work offline on the counter tablet and sync later without asking the volunteer to resolve anything.

### IV. Ask for Less

Members give a name and one way to reach them. A feature that wants more personal data must say in its spec what it is for and when it is deleted.

### V. Tests Before Shelves

A user story is built only after a failing test describes it. Tests run against a real database, not a mock of one.

### VI. Plain Words

Screens, messages and specs use the words volunteers use: tool, loan, member, due date. No internal identifiers on screen, no jargon in reminders.

## Technical Standards

**Stack**: TypeScript on the server and in the counter app, PostgreSQL for storage
**Hosting**: One small server paid for by the library association
**Accessibility**: WCAG 2.2 AA for every screen a member sees
**Languages**: English and Dutch from the first release

## Governance

A change to this constitution needs a written proposal and the agreement of two maintainers. Every plan carries a Constitution Check, and a plan that breaks a principle must say why in its Complexity Tracking table.

**Version**: 1.1.0 | **Ratified**: 2026-02-09 | **Last Amended**: 2026-06-15
