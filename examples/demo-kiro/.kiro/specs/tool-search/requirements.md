# Requirements Document

## Introduction

Members ask whether a tool is in before they walk over. Search answers that from a phone.

## Requirements

### Requirement 1: Search by name

**User Story:** As a member, I want to search tools by name, so that I know if a hedge trimmer is in before I leave home.

#### Acceptance Criteria

1. WHEN a member types words, THE Catalog SHALL list tools whose name or category contains every word
2. THE Catalog SHALL ignore letter case and accents
3. IF no tool matches, THEN the Catalog SHALL say so and show the category list

### Requirement 2: Show availability

**User Story:** As a member, I want each result to say whether the tool is in, so that I do not come for nothing.

#### Acceptance Criteria

1. WHILE a tool is lent THE Catalog SHALL show its due date in the result
2. WHERE a tool is out of use THE Catalog SHALL show it as not available
