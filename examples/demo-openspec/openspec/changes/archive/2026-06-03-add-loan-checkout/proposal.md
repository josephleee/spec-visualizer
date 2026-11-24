# Proposal: Add loan checkout

## Why

Loans are written on paper cards only. Nobody can tell which tools are out without opening every box.

## What Changes

- The counter page records a loan from the member's card and the tool's tag.
- Returning a tool closes its loan and works out any late fee.

## Capabilities

### New Capabilities
- `loans`: lending and returning at the counter.

## Impact

- New loans table; counter page; the catalog reads lent status from loans.
