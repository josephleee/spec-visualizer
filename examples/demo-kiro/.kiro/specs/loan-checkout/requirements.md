# Requirements Document

## Introduction

Loans are recorded at the counter from two scans: the member's card and the tool's tag.

## Requirements

### Requirement 1: Lend a tool

**Objective:** As a volunteer, I want to lend a tool with two scans, so that the queue at the counter moves.

#### Acceptance Criteria

1. WHEN the volunteer scans a card and a tag THEN the Desk SHALL record a loan due seven days later
2. IF the member is not in good standing, THEN the Desk SHALL refuse the loan and say why

### Requirement 2: Return a tool

**Objective:** As a volunteer, I want returns to take one scan, so that the box goes straight back to the shelf.

#### Acceptance Criteria

1. WHEN the volunteer scans a lent tool's tag THEN the Desk SHALL close its loan and show any late fee
