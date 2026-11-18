# Design: Add damage reports

## Context

Condition notes exist on each entry but nothing reads them.

## Goals / Non-Goals

**Goals:**
- One extra tap at return, no more.

**Non-Goals:**
- Charging members for damage.

## Decisions

### Decision: Out of use is a catalog state
The catalog gains a state next to "on the shelf" and "lent". Search and checkout already read that state.

## Open Questions

- Should the member who returned the tool be told?
