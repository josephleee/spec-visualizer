## Purpose
When the counter is open, so that due dates and reminders fall on days a member can come in.

## ADDED Requirements

### Requirement: Due dates fall on opening days
A due date that falls on a closed day SHALL move to the next opening day.

#### Scenario: Due on a Monday
- **GIVEN** the counter opens on Wednesday evenings and Saturday mornings
- **WHEN** a loan would be due on a Monday
- **THEN** its due date is the Wednesday after
