# Bugfix Design

## Root Cause

`lateDays` subtracts calendar dates, so any return after midnight counts a whole day more.

## Fix

Count whole 24-hour periods from the due time, after a grace hour, rounding up.

## Correctness Properties

### Property 1: Bug condition

For returns between 24 and 48 hours late, the fixed function charges two days where the old one charged three.

### Property 2: Preservation

For returns before the due time, old and new functions both charge nothing.
