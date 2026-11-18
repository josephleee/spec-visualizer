# Feature Specification: Tool Catalog

**Feature Branch**: `002-tool-catalog`
**Created**: 2026-03-02
**Status**: In Progress
**Input**: User description: "Members ask what we have and whether it is in. Volunteers answer from memory. Put the tools in a catalog."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a tool (Priority: P1)

A member or a volunteer searches the catalog by name or by what the tool is for, and sees whether it is on the shelf.

**Why this priority**: "Do you have a tile cutter?" is the most asked question at the counter.

**Independent Test**: Search for "tile" and see the tile cutter with its shelf location and whether it is in.

**Acceptance Scenarios**:

1. **Given** a catalog with a tile cutter, **When** a member searches for "tile", **Then** the tile cutter is listed with its photo and shelf location
2. **Given** a tool that is on loan, **When** it appears in results, **Then** it is marked "out" with the date it is due back
3. **Given** a search with no match, **When** the results are empty, **Then** the three closest tools by category are suggested

---

### User Story 2 - Add and edit tools (Priority: P2)

A volunteer adds a donated tool with a photo, a category and a shelf location, and corrects entries later.

**Why this priority**: The catalog is only useful while it matches the shelves.

**Independent Test**: Add a tool with a photo taken on the tablet and find it by search a moment later.

**Acceptance Scenarios**:

1. **Given** a volunteer at the counter, **When** they add a tool with a name, a category and a photo, **Then** the tool gets a label code and appears in search
2. **Given** a tool that broke beyond repair, **When** a volunteer retires it, **Then** it disappears from search but its loan history stays

---

### User Story 3 - Browse by category (Priority: P3)

A member who does not know the name of a tool browses categories such as "Garden" or "Painting".

**Why this priority**: Helpful for new members, but search covers most visits.

**Independent Test**: Open "Garden" and see only garden tools, the ones on the shelf first.

**Acceptance Scenarios**:

1. **Given** the category list, **When** a member opens "Garden", **Then** garden tools are shown with the available ones first

### Edge Cases

- Two identical drills: are they one catalog entry with two copies, or two entries?
- A tool with several parts (a drill and its case of bits) that come back incomplete.

## Requirements *(mandatory)*

### Functional Requirements

#### Search

- **FR-001**: System MUST find tools by name, category and purpose words
- **FR-002**: System MUST show for every result whether the tool is in, and if not, when it is due
- **FR-003**: System MUST answer a search in under one second on the counter tablet, offline included

#### Catalog upkeep

- **FR-004**: System MUST let a volunteer add a tool with a name, a category, a shelf location and a photo
- **FR-005**: System MUST give every copy of a tool its own label code
- **FR-006**: System MUST keep the loan history of a retired tool
- **FR-007**: System MUST let a volunteer mark a tool as "needs repair" so it cannot be lent

### Key Entities

- **Tool**: a kind of thing the library lends; name, category, purpose words, photo
- **Copy**: one physical item of a tool; label code, shelf location, condition
- **Category**: a group of tools a member can browse

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A volunteer answers "do you have X, and is it in?" in under 10 seconds
- **SC-002**: 90% of searches by members end with a tool opened
- **SC-003**: The catalog and the shelves disagree on fewer than 2% of copies at the monthly count
