# Requirements Document

## Introduction

Neighbours become members at the counter. The volunteer types three things and hands over a card.

## Glossary

- **Desk**: the counter page volunteers use.
- **Library area**: the postcodes the library serves.

## Requirements

### Requirement 1: Sign up with an address in the area

**User Story:** As a neighbour, I want to sign up at the counter, so that I can borrow tools the same day.

#### Acceptance Criteria

1. WHEN the volunteer enters a name, an address in the library area and a phone number THEN the Desk SHALL issue a member number
2. WHEN a member number is issued THE Desk SHALL print a card with that number
3. IF the address is outside the library area, THEN the Desk SHALL refuse the sign-up and name the library that covers it

### Requirement 2: One account per person

**User Story:** As a volunteer, I want to see if someone already has an account, so that nobody gets two cards.

#### Acceptance Criteria

1. WHEN the volunteer enters a phone number that belongs to a member THEN the Desk SHALL show that member instead of a new form
