# Feature Specification: Member Signup

**Feature Branch**: `001-member-signup`
**Created**: 2026-02-16
**Status**: Complete
**Input**: User description: "People should be able to become members at the counter in a minute, without filling in a paper form."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign up at the counter (Priority: P1)

A volunteer registers a new member while the person is standing at the counter.

**Why this priority**: Nobody can borrow anything before they are a member.

**Independent Test**: Register a person with a name and a phone number, then find them in the member list.

**Acceptance Scenarios**:

1. **Given** a person who is not a member, **When** the volunteer enters their name and phone number, **Then** a member card number is shown and the member appears in the list
2. **Given** a phone number that already belongs to a member, **When** the volunteer submits the form, **Then** the existing member is shown instead of a second record
3. **Given** the tablet is offline, **When** the volunteer registers a member, **Then** the member is saved on the tablet and synced when the connection returns

---

### User Story 2 - Accept the house rules (Priority: P2)

The new member reads the borrowing rules on the tablet and accepts them.

**Why this priority**: The association needs proof that the rules were accepted, but signup works without it for a first loan.

**Independent Test**: Sign up a member, accept the rules, and see the date of acceptance on their profile.

**Acceptance Scenarios**:

1. **Given** a member who has not accepted the rules, **When** they tick the box and confirm, **Then** the date is stored on their profile
2. **Given** the rules text has changed since a member accepted it, **When** that member next borrows a tool, **Then** they are asked to accept the new text

### Edge Cases

- Two volunteers register the same person on two tablets while both are offline.
- A member has no phone and gives an email address instead.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a member from a name and one contact detail (phone or email)
- **FR-002**: System MUST refuse a second member with the same contact detail and show the existing one
- **FR-003**: System MUST give every member a card number that fits on a printed label
- **FR-004**: System MUST record the date and the version of the house rules a member accepted
- **FR-005**: System MUST let a volunteer register a member while offline

### Key Entities

- **Member**: a person who may borrow; name, contact detail, card number, join date
- **Rules Acceptance**: which version of the house rules a member accepted, and when

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A volunteer registers a new member in under 60 seconds
- **SC-002**: No duplicate members after a month of use on two tablets
- **SC-003**: 95% of new members accept the house rules on their first visit
