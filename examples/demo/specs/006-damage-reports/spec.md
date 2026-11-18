# Feature Specification: Damage Reports

**Feature Branch**: `006-damage-reports`
**Created**: 2026-06-22
**Status**: Draft
**Input**: User description: "Tools come back broken and nobody knows since when. Let people report damage, with a photo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Report damage at return (Priority: P1)

A volunteer who takes back a damaged tool records what is wrong, with a photo, before it goes to the repair shelf.

**Why this priority**: Most damage is noticed at the counter, and the repair volunteers need to know what to fix.

**Independent Test**: Return a tool, add a damage report with a photo, and see it on the repair list.

**Acceptance Scenarios**:

1. **Given** a tool being returned, **When** the volunteer taps "damaged" and takes a photo, **Then** a damage report is saved and the tool is marked "needs repair"
2. **Given** a tool with an open damage report, **When** anyone searches for it, **Then** it is shown as not available

---

### User Story 2 - Report damage from home (Priority: P2)

A member who breaks a tool, or finds it broken, reports it from their phone before bringing it back.

**Why this priority**: It gives the repair volunteers a head start, and members would rather say so than be found out.

**Independent Test**: Open a current loan on a phone, report damage, and see the report at the counter.

**Acceptance Scenarios**:

1. **Given** a member with a tool on loan, **When** they send a damage report from their phone, **Then** the volunteers see it on the repair list before the tool is back
2. **Given** a member who reports damage, **When** the report is saved, **Then** they see a message that says what happens next [NEEDS CLARIFICATION: does the member pay for repairs, and does the message say so?]

---

### User Story 3 - Close a repair (Priority: P3)

A repair volunteer marks a tool as fixed, or as beyond repair.

**Why this priority**: Without it, tools stay on the repair shelf in the catalog forever.

**Independent Test**: Close a report as "fixed" and find the tool available again in search.

**Acceptance Scenarios**:

1. **Given** an open damage report, **When** a repair volunteer marks it fixed, **Then** the tool is available again
2. **Given** an open damage report, **When** a repair volunteer marks it beyond repair, **Then** the tool is retired and keeps its history

### Edge Cases

- Damage that was already there: the previous borrower returned it without anyone noticing.
- A report with no photo because the tablet camera is broken.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a volunteer attach a damage report with a description and a photo to a tool at return
- **FR-002**: System MUST let a member report damage on a tool they currently hold
- **FR-003**: System MUST mark a tool with an open damage report as not available
- **FR-004**: System MUST keep damage photos for [NEEDS CLARIFICATION: how long may photos be kept under the "Ask for Less" principle?]
- **FR-005**: System MUST let a repair volunteer close a report as fixed or beyond repair
- **FR-006**: System MUST notify [NEEDS CLARIFICATION: who is told about a new report, every repair volunteer or one coordinator?]

### Key Entities

- **Damage Report**: what is wrong with one copy of a tool; description, photo, who reported it, when, and how it was closed

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every tool on the repair shelf has a report that says what is wrong
- **SC-002**: Half of the damaged tools are available again within two weeks
