# loans Specification

## Purpose
Lending at the counter: who takes which tool, until when, and what happens when it comes back.

## Requirements

### Requirement: Check out a tool
The desk SHALL lend a tool on the shelf to a member in good standing for seven days.

#### Scenario: Member in good standing
- **GIVEN** a member in good standing and a drill on the shelf
- **WHEN** the volunteer scans the card and the drill's tag
- **THEN** the loan is recorded with a due date seven days later
- **AND** the catalog shows the drill as lent

#### Scenario: Member not in good standing
- **WHEN** the member is not in good standing
- **THEN** the desk refuses the loan and says why

### Requirement: Return a tool
The desk SHALL close a loan when the tool's tag is scanned at the counter.

#### Scenario: On time
- **WHEN** the tool is scanned on or before its due date
- **THEN** the loan closes with no fee

#### Scenario: Late
- **WHEN** the tool is scanned after its due date
- **THEN** the loan closes with a fee of fifty cents per late day, rounded up to whole days

### Requirement: Paper loan cards
Each loan SHALL also be written on a paper card kept in the tool's box.

#### Scenario: Power cut
- **WHEN** the counter computer is down
- **THEN** volunteers write the loan on the card and enter it later
