# Data Model: Tool Catalog

## Entities

### Tool

A kind of thing the library lends.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| name | text | "Tile cutter" |
| category_id | uuid | references Category |
| purpose | text[] | words members search by: "tiles", "bathroom" |
| photo_path | text | nullable |
| retired_at | timestamptz | nullable; hidden from search when set |

### Copy

One physical item of a tool.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| tool_id | uuid | references Tool |
| label_code | text | unique, printed on the item: `BB-0412` |
| shelf | text | "C3" |
| condition | enum | `ok`, `needs_repair`, `retired` |

### Category

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| name | text | unique: "Garden", "Painting" |
| sort_order | int | order in the category list |

## Relationships

- A Tool belongs to one Category.
- A Tool has one or more Copies.
- A Copy is lent, not a Tool (see `003-loan-checkout`).

## State Transitions

```text
ok ──► needs_repair ──► ok
 │            │
 └────────────┴──► retired
```
