# Tasks: Tool Catalog

**Input**: Design documents from `/specs/002-tool-catalog/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

## Phase 1: Setup

**Purpose**: Tables and module skeletons.

- [x] T001 Create the `tools`, `copies` and `categories` migrations in server/db/migrations/
- [x] T002 [P] Add the catalog module skeleton in server/catalog/
- [x] T003 [P] Add the catalog screens skeleton in app/catalog/

---

## Phase 2: Foundational

**Purpose**: The catalog mirror every story depends on.

- [x] T004 Implement the catalog store in server/catalog/store.ts
- [x] T005 Serve the full catalog with a version stamp in server/catalog/routes.ts
- [x] T006 Mirror the catalog into IndexedDB in app/offline/catalogMirror.ts

**Checkpoint**: The tablet holds the whole catalog and refreshes it when the stamp changes.

---

## Phase 3: User Story 1 - Find a tool (P1)

**Goal**: Search by name, category or purpose, with availability on every result.

**Independent Test**: Search for "tile" and see the tile cutter, its shelf and whether it is in.

- [x] T007 [P] [US1] Test: search matches name, category and purpose words in tests/catalog.test.ts
- [x] T008 [P] [US1] Test: a tool on loan shows its due date in tests/search.spec.ts
- [x] T009 [US1] Build the search index from the mirror in app/catalog/searchIndex.ts
- [x] T010 [US1] Build the search screen in app/catalog/SearchScreen.tsx
- [ ] T011 [US1] Suggest the closest tools when nothing matches in app/catalog/searchIndex.ts

---

## Phase 4: User Story 2 - Add and edit tools (P2)

**Goal**: A volunteer keeps the catalog in step with the shelves.

- [x] T012 [P] [US2] Test: every copy gets its own label code in tests/catalog.test.ts
- [ ] T013 [P] [US2] Test: a retired tool keeps its loan history in tests/catalog.test.ts
- [ ] T014 [US2] Build the tool form with photo capture in app/catalog/ToolForm.tsx
- [ ] T015 [US2] Resize and store photos in server/catalog/photos.ts
- [ ] T016 [US2] Add the "needs repair" switch to a copy in app/catalog/ToolForm.tsx

---

## Phase 5: User Story 3 - Browse by category (P3)

**Goal**: A member who does not know the name finds the tool by category.

- [ ] T017 [P] [US3] Test: available tools are listed first in tests/search.spec.ts
- [ ] T018 [US3] Build the category list in app/catalog/CategoryList.tsx

---

## Phase 6: Polish

- [ ] T019 [P] Dutch translations for the catalog screens
- [ ] T020 [P] Check the mirror stays under 20 MB with 2,000 tools
- [ ] T021 Run the monthly shelf count against the catalog once

## Dependencies

- Phase 2 blocks every user story.
- User stories 2 and 3 can be built in parallel once story 1 is done.
