## ADDED Requirements

### Requirement: Search by name
The catalog SHALL find tools whose name or category contains every word typed, ignoring letter case and accents.

#### Scenario: Partial words
- **WHEN** a member types "hedge trim"
- **THEN** the catalog lists the hedge trimmers
- **AND** each result shows whether the tool is on the shelf

#### Scenario: Nothing found
- **WHEN** no tool matches
- **THEN** the catalog says so and offers the category list
