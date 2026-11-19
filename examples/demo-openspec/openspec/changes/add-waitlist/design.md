# Design: Add a waitlist

## Context

Returns already run through one code path at the counter.

## Decisions

### Decision: Holds expire after one day
A held tool that is not picked up goes to the next member at the next opening time.

## Risks / Trade-offs

- A popular tool may never reach the shelf; that is the point.
