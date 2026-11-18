# Tasks: Member Signup

**Input**: Design documents from `/specs/001-member-signup/`

## Phase 1: Setup

**Purpose**: The members module and its table.

- [x] T001 Create the `members` table migration in server/db/migrations/001_members.sql
- [x] T002 [P] Add the members module skeleton in server/members/
- [x] T003 [P] Add the signup route to the counter app in app/signup/

---

## Phase 2: User Story 1 - Sign up at the counter (P1)

**Goal**: A volunteer registers a member in under a minute, online or offline.

**Independent Test**: Register a person, then find them in the member list.

- [x] T004 [P] [US1] Test: duplicate contact detail returns the existing member in tests/members.test.ts
- [x] T005 [P] [US1] Test: offline signup syncs once in tests/signup.spec.ts
- [x] T006 [US1] Implement member creation in server/members/store.ts
- [x] T007 [US1] Build the signup form in app/signup/SignupForm.tsx
- [x] T008 [US1] Queue offline signups in app/offline/queue.ts

---

## Phase 3: User Story 2 - Accept the house rules (P2)

**Goal**: The date and version of the accepted rules are on every profile.

- [x] T009 [P] [US2] Test: a changed rules text asks again in tests/members.test.ts
- [x] T010 [US2] Store rules acceptance in server/members/store.ts
- [x] T011 [US2] Build the rules step in app/signup/RulesStep.tsx

---

## Phase 4: Polish

- [x] T012 [P] Dutch translations for the signup screens
- [x] T013 Print the card number label from the confirmation screen
