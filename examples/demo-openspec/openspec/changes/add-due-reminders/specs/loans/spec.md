## ADDED Requirements

### Requirement: Remind before the due date
The system SHALL send one reminder two days before a loan is due, by text message when the member gave a phone number, else by e-mail.

#### Scenario: Phone number given
- **GIVEN** a loan due on Friday and a member with a phone number
- **WHEN** the daily job runs on Wednesday morning
- **THEN** the member gets one text message naming the tool and the due date

#### Scenario: Reminders turned off
- **GIVEN** a member who turned reminders off
- **WHEN** the daily job runs
- **THEN** no reminder is sent for that member's loans

## MODIFIED Requirements

### Requirement: Return a tool
The desk SHALL close a loan when the tool's tag is scanned at the counter, and SHALL cancel any reminder not yet sent.

#### Scenario: On time
- **WHEN** the tool is scanned on or before its due date
- **THEN** the loan closes with no fee

#### Scenario: Late
- **WHEN** the tool is scanned after its due date
- **THEN** the loan closes with a fee of fifty cents per late day, rounded up to whole days

#### Scenario: Returned before the reminder
- **WHEN** the tool comes back three days early
- **THEN** no reminder is sent for it
