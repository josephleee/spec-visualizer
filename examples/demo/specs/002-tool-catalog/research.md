# Research: Tool Catalog

## Search

### Where search runs

**Decision**: Search runs in the counter app on a local mirror of the catalog.

**Rationale**: The basement connection drops several times a day, and 2,000 tools fit in memory with room to spare.

**Alternatives considered**: PostgreSQL full-text search on the server (fast, but useless offline); a hosted search service (a monthly bill and member queries leaving the building).

### Search library

**Decision**: MiniSearch, with prefix and fuzzy matching switched on.

**Rationale**: It is small, has no dependencies and forgives the typos a volunteer makes with gloves on.

**Alternatives considered**: Lunr (no fuzzy matching on prefixes); writing our own substring match (no ranking).

## One entry or one per item

**Decision**: A tool is one catalog entry with one or more copies.

**Rationale**: Members look for "a drill", volunteers hand over "drill number 2". Both need to be true at once.

## Photos

Photos are taken on the tablet, resized to 800 px on the long side before upload, and stored on the server disk. No decision is open here; the library already owns the disk.
