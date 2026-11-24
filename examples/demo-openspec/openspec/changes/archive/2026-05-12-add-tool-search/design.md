# Design: Add tool search

## Context

The catalog has about 900 entries and one SQLite database. Searches come from the counter and from members' phones.

## Goals / Non-Goals

**Goals:**
- Results while typing, on the library's small server.

**Non-Goals:**
- Typo tolerance; search by photo.

## Decisions

### Decision: SQLite full-text index
The database already has FTS5. A separate search service would be one more thing for volunteers to restart.

### Decision: Fold accents before indexing
"Säge" and "sage" both find the saw: names are stored as typed and indexed without accents.

## Risks / Trade-offs

- The index must be rebuilt when an entry is renamed; a trigger does it.
