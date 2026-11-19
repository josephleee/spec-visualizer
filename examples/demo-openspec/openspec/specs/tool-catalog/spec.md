# tool-catalog Specification

## Purpose
What the library owns and where each tool is: the list members browse and volunteers keep up to date.

## Requirements

### Requirement: Every tool has an entry
The catalog SHALL hold one entry per physical tool, with a name, a category, a shelf and a condition note.

#### Scenario: Two identical drills
- **WHEN** the library owns two drills of the same model
- **THEN** the catalog shows two entries, each with its own tag number

### Requirement: Search by name
The catalog SHALL find tools whose name or category contains every word typed, ignoring letter case and accents.

#### Scenario: Partial words
- **WHEN** a member types "hedge trim"
- **THEN** the catalog lists the hedge trimmers
- **AND** each result shows whether the tool is on the shelf

#### Scenario: Nothing found
- **WHEN** no tool matches
- **THEN** the catalog says so and offers the category list
