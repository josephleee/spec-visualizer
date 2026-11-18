# Feature Specification: Loan Checkout

**Feature Branch**: `003-loan-checkout`
**Created**: 2026-04-07
**Status**: Ready for implementation

## Overview

Lending is the reason the library exists. Today a loan is a line in a paper book; this feature makes it a scan and a tap.

## User Stories

### US-1: Lend a tool
**As a** volunteer at the counter
**I want to** scan a member card and a tool label
**So that** the loan is recorded before the member leaves the desk

**Acceptance Criteria:**
- Given a member with no overdue loans and a tool that is on the shelf
- When I scan the member card and then the tool label
- Then a loan is created with a due date two weeks from today
- And the tool shows as "out" in the catalog
- Given a member who already holds five tools
- When I scan a sixth tool
- Then the loan is refused with the reason on screen

### US-2: Take a tool back
**As a** volunteer at the counter
**I want to** scan a returned tool
**So that** it is back in the catalog for the next member

**Acceptance Criteria:**
- Given a tool that is on loan
- When I scan its label
- Then the loan is closed with today's date
- And the tool shows as "in" in the catalog
- Given a tool that comes back broken
- When I mark it "needs repair" while returning it
- Then the loan is closed and the tool cannot be lent
- But the member is not blocked from borrowing

### US-3: Extend a loan
**As a** member
**I want to** extend my loan once from my phone
**So that** I do not have to come in when a job takes longer

**Acceptance Criteria:**
- Given a loan that is not overdue and that nobody is waiting for
- When I tap "extend"
- Then the due date moves one week
- Given a loan that was extended before
- When I tap "extend"
- Then I am told to ask at the counter

## Requirements

### Functional Requirements

- **FR-001**: System MUST create a loan from one member card scan and one tool label scan
- **FR-002**: System MUST set the due date to 14 days after checkout
- **FR-003**: System MUST refuse a loan when the member holds five tools or has an overdue loan
- **FR-004**: System MUST close a loan when the tool label is scanned at return
- **FR-005**: System MUST let a member extend a loan once by 7 days
- **FR-006**: System MUST record checkouts and returns while offline and sync them in order

### Non-Functional Requirements

- **NFR-001**: A checkout takes at most three taps after the two scans
- **NFR-002**: No loan is lost when the tablet loses power between scan and sync

## Out of Scope

- Deposits and fines
- Reserving a tool that is on the shelf
