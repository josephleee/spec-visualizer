# Implementation Plan: Tool search

## Overview

Index first, then the page, then availability.

## Tasks

- [x] 1. Build the search index
  - [x] 1.1 Add the FTS5 table and keep it current with triggers
    - rebuilt when an entry is renamed
    - _Requirements: 1.1_
  - [x] 1.2 Fold accents before indexing
    - _Requirements: 1.2_
  - [ ]* 1.3 Write a property test for Property 1
    - **Property 1: Every tool is findable by its own name**
    - **Validates: Requirements 1.1**
- [ ] 2. Search page
  - [x] 2.1 Search box with results while typing
  - [-] 2.2 Empty result with the category list
    - _Requirements: 1.3_
  - [ ]* 2.3 Write a property test for Property 2
- [ ] 3. Checkpoint: search answers on the counter computer
- [ ] 4. Availability in results
  - [ ] 4.1 Due date for lent tools
  - [ ] 4.2 Out-of-use tools shown as not available

## Notes

- Tasks marked with `*` are optional test tasks.
