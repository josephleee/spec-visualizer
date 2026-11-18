# Spec-driven development formats

What spec-visualizer would have to read to show a project written with a spec-driven development (SDD) tool other than GitHub spec-kit. Every statement here comes from the tool's own repository or documentation, or from real projects that use it; the sources are listed under each format. Researched on 2026-11-18.

The design that follows from this survey is in [design-formats.md](design-formats.md).

## Summary

| Format | Where its documents live | Unit of work | Progress is | Licence | Use (evidence below) | Read by spec-visualizer |
|---|---|---|---|---|---|---|
| spec-kit | `.specify/memory/constitution.md`, `specs/<feature>/` | feature | checkboxes in `tasks.md` | MIT | 150k stars; 14.5k `constitution.md` files on GitHub | yes, as before |
| OpenSpec | `openspec/specs/`, `openspec/changes/<change>/`, `openspec/changes/archive/` | change | checkboxes in `tasks.md`, then the move to `archive/` | MIT | 75k stars; 5.0M npm downloads a month; 270k `proposal.md` files | yes, new |
| Kiro specs | `.kiro/steering/`, `.kiro/specs/<spec>/` | spec | checkboxes in `tasks.md` | product: proprietary; the spec files are the user's | 39.6k `requirements.md` files under `.kiro/specs` | yes, new |
| cc-sdd | the Kiro layout, plus `spec.json` | spec | checkboxes, and approval flags in `spec.json` | MIT | 3.8k stars; 64k npm downloads a month | as Kiro (its commands are not named) |
| BMad Method | `_bmad-output/` (v6: `planning-artifacts/`, `sprint-status.yaml`; v7: initiatives, `tickets.toml`) | story / ticket | status fields in plans and TOML | MIT (code), trademarked name | 55k stars; 92k npm downloads a month | no |
| Agent OS | `agent-os/product/`, `agent-os/specs/<date-slug>/`, `agent-os/standards/` | spec | none in v3 (the agent's own todo list) | MIT | 5.6k stars; ~900 `shape.md` files | no |
| Tessl | `specs/*.spec.md` next to the code | spec file | none (tests linked with `[@test]`) | tile: MIT; CLI: not stated | 19k npm downloads a month of `@tessl/cli` | no |

"Use" figures: GitHub stars from the GitHub API, npm downloads from `api.npmjs.org` for 2026-10-18 to 2026-11-16, file counts from GitHub code search (`filename:<file> path:<folder>`, files, not repositories). They show order of magnitude, not exact adoption.

## spec-kit (the reference)

Documented in [design.md](design.md) and [parsing-rules.md](parsing-rules.md) (Korean). In short: one constitution at `.specify/memory/constitution.md`, one folder per feature under `specs/` with `spec.md`, `plan.md` (plus `research.md`, `data-model.md`, `quickstart.md`, `contracts/`), `tasks.md` and `checklists/*.md`; commands `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`. Stage follows from which files exist and how many `tasks.md` boxes are ticked.

## OpenSpec

Sources: [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) at `f085c85` (2026-11-17, package version 2.1.0): `docs/concepts.md`, `docs/writing-specs.md`, `docs/commands.md`, `docs-lab/help/upgrade-to-2.md`, `docs-lab/reference/supported-tools.md`, `schemas/spec-driven/schema.yaml` and `templates/`, `src/core/parsers/requirement-blocks.ts`, `src/utils/task-progress.ts`, `src/core/list.ts`, and the repository's own `openspec/` folder (OpenSpec is written with OpenSpec: 40 specs, 4 active changes and 108 archived ones).

### Layout

```text
openspec/
├── config.yaml                 project context and rules (1.x and later); YAML
├── project.md                  project context in 0.x; kept by later versions if the user wrote it
├── specs/<capability>/spec.md  the source of truth, one spec per capability; may nest (specs/<area>/<capability>/spec.md)
└── changes/
    ├── <change>/               one folder per proposed change, kebab-case name
    │   ├── .openspec.yaml      optional metadata: schema, created, skip_specs, retire_capabilities
    │   ├── proposal.md
    │   ├── design.md           optional
    │   ├── tasks.md
    │   └── specs/<capability>/spec.md   delta specs
    └── archive/YYYY-MM-DD-<change>/     finished changes, moved here whole
```

A custom schema can rename or add artifacts (`openspec/schemas/<name>/schema.yaml`); the default `spec-driven` schema has exactly the four above.

### Documents and their markdown

| Document | Convention |
|---|---|
| `specs/<capability>/spec.md` | `# <name> Specification`, `## Purpose`, `## Requirements`; each `### Requirement: <name>` holds a statement with SHALL or MUST, then one or more `#### Scenario: <name>` with list items `- **WHEN** …`, `- **THEN** …`, `- **AND** …` (GIVEN also appears; the bold is optional) |
| delta `specs/<capability>/spec.md` | the same requirement blocks under `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements` (a requirement header with a reason) and `## RENAMED Requirements` (`- FROM: ### Requirement: A` / `- TO: ### Requirement: B`); `## Purpose` only for a new capability. Section names are matched without regard to case |
| `proposal.md` | `## Why`, `## What Changes` (bullets, `**BREAKING**` marks), `## Capabilities` with `### New Capabilities` / `### Modified Capabilities` as `` - `<capability>`: … `` items, `## Impact` |
| `design.md` | `## Context`, `## Goals / Non-Goals` (`**Goals:**`, `**Non-Goals:**`), `## Decisions` (often `### Decision: …`), `## Risks / Trade-offs`, sometimes `## Migration Plan`, `## Open Questions` |
| `tasks.md` | `## 1. <group>` with `- [ ] 1.1 <task>`; sub-tasks may nest. Any single-character mark counts as a task (`[~]`, `[]`, `[ x ]`); only `x`/`X` means done |

### Progress and stages

- A change's status in `openspec list` is `no-tasks`, `in-progress` or `complete`, from the `tasks.md` boxes (`src/core/list.ts`). Archiving moves the folder to `changes/archive/<date>-<name>/` and merges its deltas into `openspec/specs/`.
- Artifact order of the default schema: proposal → specs → design → tasks → implement → archive. Dependencies are "enablers, not gates": design is optional and specs and design may come in either order.

### Commands

OpenSpec 2.x ships skills, no command files (`docs-lab/help/upgrade-to-2.md`). In Claude Code and most tools a skill is typed as `/openspec-<skill>`, in Codex as `$openspec-<skill>`. The 1.x commands map one to one:

| 2.x skill | 1.x command | Does |
|---|---|---|
| `/openspec-explore` | `/opsx:explore` | think before a change |
| `/openspec-propose` | `/opsx:propose` | create a change with proposal, specs, design, tasks |
| `/openspec-continue-change` | `/opsx:continue` | create the next missing artifact (expanded profile) |
| `/openspec-ff-change` | `/opsx:ff` | create all remaining artifacts (expanded profile) |
| `/openspec-apply-change` | `/opsx:apply` | implement the tasks, ticking them off |
| `/openspec-verify-change` | `/opsx:verify` | check the code against the change (expanded profile) |
| `/openspec-sync-specs` | `/opsx:sync` | merge deltas into the main specs without archiving |
| `/openspec-archive-change` | `/opsx:archive` | merge and move the change to `archive/` |

0.x used `/openspec:proposal`, `/openspec:apply`, `/openspec:archive`. The terminal CLI (`openspec init`, `openspec list`, `openspec validate`, `openspec archive`) is separate from these.

### Licence and use

MIT. 75,128 stars, 5,155 forks; `@fission-ai/openspec` had 4,982,829 npm downloads in the month to 2026-11-16; GitHub code search finds 269,824 `proposal.md` files under `openspec/changes` and 190,208 `spec.md` under `openspec/specs`.

## Kiro specs

Sources: the Kiro documentation in its Markdown form (`https://kiro.dev/docs/specs.md`, `specs/feature-specs.md`, `specs/feature-specs/requirements-first.md`, `specs/feature-specs/tech-design-first.md`, `specs/bugfix-specs.md`, `specs/quick-spec.md`, `specs/best-practices.md`, `steering.md`, fetched 2026-11-18). [kirodotdev/Kiro](https://github.com/kirodotdev/Kiro) is only the issue tracker; the product is closed source, so the exact file shapes were checked against real projects: `sebsto/wispr` (`cli-tool`), `darko-mesaros/shuk` (`upload-only`), `growilabs/growi` (`hotkeys`), `chara-codes/chara` (`dark-theme`), `izumin5210/gqlkit` (`inline-enum`), three `bugfix.md` files from `RankFTW/RHI`, and 60 `tasks.md` files from GitHub code search. None of their text is copied into this repository.

### Layout

```text
.kiro/
├── steering/*.md              project context: product.md, tech.md, structure.md by default, any other .md
└── specs/<name>/              one folder per spec
    ├── requirements.md        feature specs (or bugfix.md for a bugfix spec)
    ├── design.md
    └── tasks.md
```

Global steering lives in `~/.kiro/steering/`, outside the project. Steering files may start with YAML front matter (`inclusion: always | fileMatch | manual | auto`).

### Documents and their markdown

| Document | Convention (as generated) |
|---|---|
| `requirements.md` | `# Requirements Document`, `## Introduction`, often `## Glossary` (`- **Term**: …`), `## Requirements`; each `### Requirement N` or `### Requirement N: <title>` has `**User Story:** As a …, I want …, so that …` and `#### Acceptance Criteria` as a numbered list of EARS sentences |
| EARS sentences | `WHEN <event> THEN the system SHALL <response>`; newer files write `WHEN <event>, THE <Component> SHALL <response>`; also `IF … THEN …`, `WHILE …`, `WHERE …`, and `THE <Component> SHALL …` with no condition. The documentation itself shows the two-line form `WHEN …` / `THE SYSTEM SHALL …` |
| `bugfix.md` | `# Bugfix Requirements Document`, `## Introduction`, `## Bug Analysis` with `### Current Behavior (Defect)`, `### Expected Behavior (Correct)`, `### Unchanged Behavior (Regression Prevention)`; items `1.1 WHEN … THEN the system …`, `2.1 … SHALL …`, `3.1 … SHALL CONTINUE TO …` |
| `design.md` | free sections; usually `## Overview`, `## Architecture`, `## Components and Interfaces`, `## Data Models`, `## Error Handling`, `## Testing Strategy`, newer ones `## Correctness Properties` with `### Property N: …`; Mermaid blocks are common |
| `tasks.md` | `# Implementation Plan`, sometimes `## Overview`, `## Tasks`, `## Notes`; `- [ ] 1. <task>` with nested `- [ ] 1.1 <sub-task>`, detail bullets and `_Requirements: 1.1, 2.3_` under each. `- [ ]*` marks an optional task (7 of the 60 sampled files), `- [-]` a task in progress (1 of 60) |

### Progress and stages

Requirements (or bug analysis) → design → tasks → implementation, with an approval gate between phases; the design-first variant writes `design.md` before `requirements.md`. Kiro shows task status in its editor and ticks the boxes as tasks finish. "Run all tasks" runs only the required (not optional) tasks.

### Commands

The IDE works with buttons in the spec pane. The Kiro CLI has `/spec new <name>` (start a spec), `/spec <name>` (resume it, phase by phase) and `/spec run <name>` (run its tasks). Steering is written by hand or with the IDE's "Generate Steering Docs" button.

### Licence and use

Kiro is a proprietary AWS product; the spec files belong to the project that holds them. GitHub code search finds 39,616 `requirements.md` and 38,016 `tasks.md` files under `.kiro/specs`; the issue tracker has 4,481 stars.

## cc-sdd

Source: [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) at `e2a0c67` (2026-09-23): `README.md`, `tools/cc-sdd/templates/shared/settings/templates/specs/`, `.kiro/specs/photo-albums-en/`. MIT; 3,771 stars; 63,885 npm downloads in the month to 2026-11-16.

It brings "Kiro-style" specs to Claude Code, Codex and others and writes into the same `.kiro/specs/<name>/` and `.kiro/steering/` folders, so a cc-sdd project looks like a Kiro project. Differences: a `spec.json` per spec with `phase` and per-document `approvals`; sub-tasks are often written flat (`- [ ] 1.` then `- [ ] 1.1` at the same indent); `(P)` after a task number marks parallel work; `- [ ]*` marks deferrable test tasks; optional `research.md`, `brief.md`, `roadmap.md`; requirements say `**Objective:**` where Kiro says `**User Story:**`. Its commands are `/kiro-discovery`, `/kiro-spec-init`, `/kiro-spec-requirements`, `/kiro-spec-design`, `/kiro-spec-tasks`, `/kiro-impl` and others.

## BMad Method

Source: [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) at `e435a22` (2026-11-12): `README.md`, `docs/plan/break-work-into-stories-and-track-it.md`, `docs/plan/set-up-the-ticket-tree.md`, `docs/plan/choose-a-planning-path.md`. MIT for the code, the name is a trademark; 55,496 stars; `bmad-method` had 91,500 npm downloads in the month to 2026-11-16.

Two lines ship at once: v6.12 (stable) writes `_bmad-output/planning-artifacts/` (`brief.md`, `prd.md`, `architecture.md`, UX documents), `epics.md`, `sprint-status.yaml` and story files; v7 (preview alpha, "expect breaking changes") writes initiative folders with `<type>-<slug>/<type>-<slug>.md` documents and `tickets/tickets.toml` trees, with build status in `story-<slug>-plan.md`. Work is driven by agent skills (`bmad-build`, `bmad-agent-po`, `bmad-code-review` …) rather than a fixed stage list. Progress lives in YAML/TOML and status fields, not in checkboxes.

## Agent OS

Source: [buildermethods/agent-os](https://github.com/buildermethods/agent-os) at `e892e61` (2026-10-07): `README.md`, `CHANGELOG.md`, `commands/agent-os/*.md`. MIT; 5,617 stars; GitHub code search finds 908 `shape.md` files under `agent-os/specs`.

v3 (2026-01) writes `agent-os/product/` (`mission.md`, `roadmap.md`, `tech-stack.md`), `agent-os/standards/` with `index.yml`, and per spec `agent-os/specs/YYYY-MM-DD-HHMM-<slug>/` with `plan.md`, `shape.md`, `standards.md`, `references.md`, `visuals/`. Commands: `/plan-product`, `/shape-spec` (run in plan mode), `/discover-standards`, `/inject-standards`, `/index-standards`. v3 deliberately leaves task tracking to the coding tool, so there is no progress in the files. v2 wrote `spec.md`, `tasks.md` and `planning/requirements.md` instead.

## Tessl

Source: [tesslio/spec-driven-development-tile](https://github.com/tesslio/spec-driven-development-tile) at `b8fdff7` (2026-03-30): `docs/spec-format.md`, `skills/spec-writer/SKILL.md`. Tile MIT; the `tesslio/cli` repository states no licence; `@tessl/cli` had 19,414 npm downloads in the month to 2026-11-16.

Specs are `*.spec.md` files in `specs/` with YAML front matter (`name`, `description`, `targets` globs), an API code block and requirement bullets each followed by a `` `[@test] <path>` `` link. There are no stages and no progress: a spec describes code that exists. Note that a Tessl `specs/` folder also matches spec-kit's detection rule (it only checks that `specs/` exists); its loose `*.spec.md` files are not feature folders, so spec-visualizer shows such a project as a spec-kit project with no features.

## What this means for spec-visualizer

- OpenSpec and Kiro are the two formats with a fixed folder layout, a stage order and progress in the files, and both are widely used. They are supported. cc-sdd projects use the Kiro layout and are read by the Kiro adapter.
- BMad changes its layout between lines and keeps progress outside markdown checkboxes; Agent OS v3 keeps no progress at all; Tessl has no stages. None of them fits a stage board without inventing data, so they are left out for now.
