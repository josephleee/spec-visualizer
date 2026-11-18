# Feature Specification: Waitlist

**Feature Branch**: `005-waitlist`
**Created**: 2026-06-01
**Status**: Draft

## Overview

The pressure washer and the two ladders are almost never on the shelf. Members ask the volunteers to "call me when it's back", and the volunteers keep sticky notes. This feature replaces the sticky notes.

## User Stories

### US-1: Join the waitlist
**As a** member
**I want to** put my name down for a tool that is out
**So that** I do not have to keep checking whether it came back

**Acceptance Criteria:**
- Given a tool with every copy on loan
- When I tap "tell me when it's back"
- Then I am added to the end of the waitlist for that tool
- And I see my place in the queue
- Given a tool that is on the shelf
- When I open its page
- Then there is no waitlist button

### US-2: Be told when it is back
**As a** member on a waitlist
**I want to** get a message when the tool is returned
**So that** I can come and borrow it

**Acceptance Criteria:**
- Given I am first on the waitlist for a tool
- When a copy of it is returned
- Then I get a message saying it is held for me for three days
- And the copy cannot be lent to anyone else during those days
- Given I do not collect the tool within three days
- When the hold ends
- Then the next member on the waitlist is told
- But I keep my membership without any penalty

### US-3: See who is waiting
**As a** volunteer
**I want to** see the waitlist of a tool when it is returned
**So that** I put it on the hold shelf instead of the normal one

**Acceptance Criteria:**
- Given a returned tool with a waitlist
- When I scan it at return
- Then the screen says "hold for" and the first member's name

## Requirements

### Functional Requirements

- **FR-001**: System MUST let a member join the waitlist of a tool only when no copy is available
- **FR-002**: System MUST keep the waitlist in the order members joined
- **FR-003**: System MUST hold a returned copy for the first waiting member for three days
- **FR-004**: System MUST tell the next member when a hold ends without a loan
- **FR-005**: System MUST show the hold on the return screen

## Success Criteria

### Measurable Outcomes

- **SC-001**: No sticky notes on the counter after one month
- **SC-002**: 80% of holds end in a loan
