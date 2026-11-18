## Purpose
Queueing for a tool that is lent, so it goes to the next member in line instead of back to the shelf.

## ADDED Requirements

### Requirement: Join the waitlist
A member in good standing SHALL be able to join the waitlist of a lent tool once.

#### Scenario: Tool is lent
- **WHEN** a member opens a lent tool and chooses "Tell me when it is back"
- **THEN** the member is added at the end of that tool's waitlist

### Requirement: Hold on return
When a tool with a waitlist comes back, the desk SHALL hold it for the first member on the list for one day.

#### Scenario: Held tool
- **GIVEN** a tile cutter with two members waiting
- **WHEN** the tile cutter is returned
- **THEN** it is held for the first member, who gets a message
- **AND** the catalog shows it as held, not on the shelf
