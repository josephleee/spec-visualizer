# Tasks: Loan Checkout

**Input**: Design documents from `/specs/003-loan-checkout/`

## Phase 1: Setup

**Purpose**: The loan events table and module skeletons.

- [ ] T001 Create the `loan_events` migration in server/db/migrations/
- [ ] T002 [P] Add the loans module skeleton in server/loans/
- [ ] T003 [P] Add the checkout screens skeleton in app/checkout/

---

## Phase 2: Foundational

**Purpose**: The event log and the outbox that every story writes to.

- [ ] T004 Implement the append-only event store in server/loans/events.ts
- [ ] T005 Implement the tablet outbox with ordered replay in app/offline/outbox.ts
- [ ] T006 [P] Test: an event replayed twice is applied once in tests/loans.test.ts

---

## Phase 3: User Story 1 - Lend a tool

**Goal**: Two scans make a loan.

- [ ] T007 [P] [US1] Test: a sixth tool is refused in tests/loans.test.ts
- [ ] T008 [P] [US1] Test: an overdue member is refused in tests/loans.test.ts
- [ ] T009 [US1] Implement the lending rules in server/loans/rules.ts
- [ ] T010 [US1] Build the scan screen in app/checkout/ScanScreen.tsx

---

## Phase 4: User Story 2 - Take a tool back

**Goal**: One scan closes a loan.

- [ ] T011 [P] [US2] Test: a broken return closes the loan and blocks the tool in tests/loans.test.ts
- [ ] T012 [US2] Build the return screen in app/checkout/ReturnScreen.tsx

---

## Phase 5: User Story 3 - Extend a loan

**Goal**: One extension from the member's phone.

- [ ] T013 [P] [US3] Test: a second extension is refused in tests/loans.test.ts
- [ ] T014 [US3] Add the extend route in server/loans/routes.ts
- [ ] T015 [US3] Add the extend button to the member page in app/member/Loans.tsx
