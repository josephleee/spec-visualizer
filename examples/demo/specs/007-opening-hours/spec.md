# Feature Specification: Opening Hours

**Feature Branch**: `007-opening-hours`
**Created**: 2026-07-06
**Status**: Draft
**Input**: User description: "Due dates land on days we are closed. Show the opening hours and never set a due date on a closed day."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Due dates on open days only (Priority: P1)

A loan is never due on a day the library is closed.

**Why this priority**: A due date on a closed day makes a member late through no fault of their own.

**Independent Test**: Lend a tool so that 14 days later is a closed day, and see the due date moved to the next open day.

**Acceptance Scenarios**:

1. **Given** the library is closed on Sundays, **When** a loan would be due on a Sunday, **Then** its due date is the following open day
2. **Given** a holiday closure entered by a volunteer, **When** a loan would be due inside it, **Then** its due date is the first open day after the closure

---

### User Story 2 - See when the library is open (Priority: P2)

A member sees the opening hours and upcoming closures on the catalog page.

**Why this priority**: It saves a trip, but the hours are also on the door.

**Independent Test**: Enter a closure for next week and see it on the catalog page.

**Acceptance Scenarios**:

1. **Given** a closure next Saturday, **When** a member opens the catalog, **Then** a notice names the day the library is closed

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store the weekly opening hours and single-day closures
- **FR-002**: System MUST move a due date that falls on a closed day to the next open day
- **FR-003**: System MUST show the opening hours and the next closure on the catalog page

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: No loan is due on a closed day
