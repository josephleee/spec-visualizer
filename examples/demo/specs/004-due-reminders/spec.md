# Feature Specification: Due Date Reminders

**Feature Branch**: `004-due-reminders`
**Created**: 2026-05-11
**Status**: Planned
**Input**: User description: "A third of the tools come back late, mostly because people forget. Remind them."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reminder before the due date (Priority: P1)

A member gets a message two days before a tool is due, by the contact detail they gave at signup.

**Why this priority**: Forgetting is the main cause of late returns; one message fixes most of it.

**Independent Test**: Create a loan due in two days, run the daily job, and see one message addressed to the member.

**Acceptance Scenarios**:

1. **Given** a loan due in two days, **When** the daily reminder job runs, **Then** the member gets one message naming the tool and the due date
2. **Given** a member with three loans due on the same day, **When** the job runs, **Then** they get one message listing all three tools
3. **Given** a loan that was already reminded, **When** the job runs again the same day, **Then** no second message is sent

---

### User Story 2 - Overdue notice (Priority: P2)

A member whose tool is late gets a notice the day after, and the volunteers see the list of overdue loans.

**Why this priority**: Needed for the tools that still come back late, but it helps fewer members than the first reminder.

**Independent Test**: Let a loan pass its due date, run the job, and see the notice and the loan on the overdue list.

**Acceptance Scenarios**:

1. **Given** a loan one day past its due date, **When** the daily job runs, **Then** the member gets an overdue notice
2. **Given** a loan that has been overdue for a week, **When** a volunteer opens the overdue list, **Then** the loan is at the top with the member's contact detail

---

### User Story 3 - Stop the reminders (Priority: P3)

A member who does not want messages turns them off.

**Why this priority**: Required by the "Ask for Less" principle, used by few.

**Independent Test**: Turn reminders off for a member, run the job, and see that nothing is sent to them.

**Acceptance Scenarios**:

1. **Given** a member who turned reminders off, **When** one of their loans is due in two days, **Then** no message is sent and the loan still appears on the volunteers' list

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST send one reminder per member two days before a due date, listing every tool due that day
- **FR-002**: System MUST send one overdue notice the day after a missed due date
- **FR-003**: System MUST never send the same reminder twice
- **FR-004**: System MUST send by SMS when the member gave a phone number and by email otherwise
- **FR-005**: System MUST let a member turn reminders off with one tap from any message
- **FR-006**: System MUST show volunteers a list of overdue loans, oldest first

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Late returns fall from 33% to under 15% within two months
- **SC-002**: Fewer than 1 in 100 members turns reminders off
- **SC-003**: The association pays less than 10 euros a month for messages
