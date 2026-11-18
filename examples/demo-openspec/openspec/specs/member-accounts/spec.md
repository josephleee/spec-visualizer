# member-accounts Specification

## Purpose
Who may borrow: how a neighbour becomes a member, proves it at the counter and keeps the account in good standing.

## Requirements

### Requirement: Sign up at the counter
The desk SHALL create a member account from a name, a postal address inside the library's area and a phone number or e-mail address.

#### Scenario: Address inside the area
- **GIVEN** a visitor whose address is inside the library's area
- **WHEN** the volunteer enters the name, address and phone number
- **THEN** a member number is issued
- **AND** a membership card is printed with that number

#### Scenario: Address outside the area
- **WHEN** the address is outside the library's area
- **THEN** the desk refuses the sign-up and shows the nearest library that covers it

### Requirement: Good standing
A member SHALL be in good standing unless a loan is more than seven days overdue or a fee above five euros is unpaid.

#### Scenario: Overdue for eight days
- **GIVEN** a member with one loan overdue by eight days
- **WHEN** the volunteer opens the member's page
- **THEN** the page shows the member as not in good standing, with the overdue tool named
