# Requirements Document

## Introduction

The tile cutters are out every weekend. Members want to queue for them.

## Requirements

### Requirement 1: Join a waitlist

**User Story:** As a member, I want to queue for a lent tool, so that I get it next.

#### Acceptance Criteria

1. WHEN a member asks for a lent tool THE Catalog SHALL add the member to the end of its waitlist
2. IF the member is already on that waitlist, THEN the Catalog SHALL keep the member's place

### Requirement 2: Hold a returned tool

**User Story:** As the first member waiting, I want the tool kept for me, so that nobody takes it from the shelf first.

#### Acceptance Criteria

1. WHEN a tool with a waitlist is returned THE Desk SHALL hold it for one day for the first member waiting
