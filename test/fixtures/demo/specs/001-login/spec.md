# Feature Specification: Login

**Feature Branch**: `001-login`
**Created**: 2026-02-01
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with email (Priority: P1)

A visitor signs in with email and password.

**Why this priority**: Nothing else works without it.

**Independent Test**: Sign in with a valid account and see the dashboard.

**Acceptance Scenarios**:

1. **Given** a registered user, **When** they submit valid credentials, **Then** they reach the dashboard
2. **Given** a registered user, **When** they submit a wrong password, **Then** an error is shown

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST authenticate users by email and password
- **FR-002**: System MUST lock an account after 5 failed attempts
- **FR-003**: System MUST support password reset [NEEDS CLARIFICATION: reset link lifetime not specified]

## Rollout Notes

This section is not in the template. <img src=x onerror=alert(1)>
