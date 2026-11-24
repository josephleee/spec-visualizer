# Requirements Document

## Introduction

A message two days before a loan is due, so members are not charged for forgetting.

## Requirements

### Requirement 1: Remind before the due date

**User Story:** As a member, I want a reminder two days before a tool is due, so that I bring it back in time.

#### Acceptance Criteria

1. WHEN a loan is due in two days THE Reminder Job SHALL send the member one message
2. WHERE the member gave a phone number THE Reminder Job SHALL send a text message instead of an e-mail
3. IF the member turned reminders off, THEN the Reminder Job SHALL send nothing
