# Design: other spec-driven formats

How spec-visualizer reads projects written with OpenSpec or Kiro next to spec-kit, without changing what a spec-kit project shows. The formats themselves are described in [formats.md](formats.md); the existing tool in [design.md](design.md) (Korean).

## Goal and limits

- A folder written with **spec-kit**, **OpenSpec** or **Kiro** opens on the same board: six stage cards, the units of work standing at each stage, the next command, and one page per document, drawn for its kind.
- **spec-kit output does not change.** The JSON of `/api/project` and `/api/doc`, and the HTML of the strip, the board and every page in both languages, are compared with the version before this change for `examples/demo` and `test/fixtures/demo` (`test/speckit-golden.test.ts`).
- The standing rules hold for every format: nothing in a document is dropped, nothing moves after it appears, document content is untrusted, the server stays local and read-only.

## Vocabulary

What spec-kit calls a **feature**, OpenSpec calls a **change** and Kiro a **spec**. In code and in the JSON the unit stays `Feature` (no rename, so spec-kit JSON is unchanged). On screen each format uses its own word: every label that says "feature" / "기능" is shown as "change" / "변경" for OpenSpec and "spec" / "스펙" for Kiro (`web/i18n.ts`, a per-format word swap tested against every label).

The first stage of every format is the **project stage**: documents that belong to the whole project, not to a unit. spec-kit: the constitution. OpenSpec: the main specs (one per capability) and the project context (`config.yaml`, `project.md`). Kiro: the steering files.

## Detection

The format is decided once, when the server starts, and does not change while it runs.

| Format | The folder matches when it has |
|---|---|
| spec-kit | a `specs/` or `.specify/` directory (the rule used so far) |
| OpenSpec | an `openspec/` directory |
| Kiro | a `.kiro/specs/` or `.kiro/steering/` directory |

- **One match**: that format.
- **Several**: spec-kit first, then OpenSpec, then Kiro. The CLI prints the formats it did not choose and the `--format` option that picks one. *Reason*: a folder that opened as spec-kit before this change must open the same way after it. *Cost if wrong*: an OpenSpec or Kiro project that also has an unrelated `specs/` folder opens as spec-kit until the user passes `--format`.
- **None**: the CLI stops with the message it printed before (`Not a spec-kit project: no specs/ or .specify/ folder in …`) and a second line naming the OpenSpec and Kiro folders it also looked for.
- **`--format <spec-kit|openspec|kiro>`** overrides detection. The folder must still match that format's rule; otherwise the CLI stops with `Not a <format> project: …`.
- Symlinked folders never match, as before (detection uses `lstat`).

## Server: the adapter

`server/formats.ts` holds one adapter per format. An adapter is plain data and functions:

| Part | What it is | spec-kit | OpenSpec | Kiro |
|---|---|---|---|---|
| `id`, `name`, `unit` | for the CLI line | `spec-kit`, features | `openspec`, `OpenSpec`, changes | `kiro`, `Kiro`, specs |
| `matches(root)` | detection rule | `specs/` or `.specify/` | `openspec/` | `.kiro/specs/` or `.kiro/steering/` |
| `watch` | folders watched for live updates | `specs`, `.specify` | `openspec` | `.kiro` |
| `scan(root, branch)` | the `Project` | `scanProject`, unchanged | `scanOpenSpec` | `scanKiro` |
| `parsers` | the parser for each document kind | the existing table | see below | see below |
| `frontMatter` | lift YAML front matter into the header fields | no | no | yes (steering files) |

`startServer` takes the adapter; `/api/project` returns its scan, `/api/doc` parses with its parsers and serves only documents its scan listed, and `index.html` is served with `data-format` on its `<html>` element so the page knows the format before the first request returns (the loading skeleton already shows the right stage names).

### What the scan returns

`Project` and `Feature` keep their shape. Two optional fields are added, and both are left out for spec-kit, which keeps its JSON byte for byte:

- `Project.format`: `'openspec'` or `'kiro'`; absent means spec-kit.
- `Project.shared`: the documents of the project stage other than a constitution.

`Feature.stage` takes the stage keys of each format. `Feature.openQuestions` is 0 outside spec-kit, which has the only `NEEDS CLARIFICATION` convention.

### Units and stages

| | spec-kit | OpenSpec | Kiro |
|---|---|---|---|
| Unit | `specs/<feature>/` | `openspec/changes/<change>/`, and `openspec/changes/archive/<date>-<change>/` as `archive/<date>-<change>` | `.kiro/specs/<spec>/` |
| Order | number prefix, current branch first | active by name, then archived newest first; current branch first | number prefix, then name; current branch first |
| Stage 1 (project) | constitution | **specs**: `openspec/specs/**/spec.md`, then `config.yaml`, `project.md` | **steering**: `.kiro/steering/**/*.md`, `product.md`, `tech.md`, `structure.md` first |
| Stage 2 | specify | **propose**: `proposal.md`, delta `specs/**/spec.md` | **requirements**: `requirements.md` or `bugfix.md` |
| Stage 3 | plan | **design**: `design.md` | **design**: `design.md` |
| Stage 4 | tasks | **tasks**: `tasks.md` (structure) | **tasks**: `tasks.md` (structure) |
| Stage 5 | implement | **apply**: `tasks.md` (progress) | **implement**: `tasks.md` (progress) |
| Stage 6 | done | **archive**: delta specs of the archived change | **done**: `tasks.md` (progress) |
| Stage of a unit, first rule that holds | all tasks ticked → done; one ticked → implement; `tasks.md` → tasks; `plan.md` → plan; else specify | in `archive/` → archive; one task ticked → apply; `tasks.md` → tasks; `design.md` → design; else propose | all required tasks ticked → done; one ticked → implement; `tasks.md` → tasks; `design.md` → design; else requirements |

OpenSpec: a change whose tasks are all ticked stays at **apply** until it is archived, because archiving is a step the user takes (`/openspec-archive-change`); its next command says so. Kiro: optional tasks (`- [ ]*`) are listed but not counted, because Kiro's own "run all tasks" leaves them out; a spec whose required tasks are done is done.

### Document kinds and parsers

New kinds are added only where an existing one would draw the document wrongly. A kind that two formats share is drawn by the same form, and each adapter may read it with its own parser.

| Kind | Documents | Parser | Blocks |
|---|---|---|---|
| `tasks` (existing) | OpenSpec `tasks.md` | `##` groups as phases, items with any one-character mark (`[~]` is open), numbers like `1.1` as ids, text nested under an item kept with it | `phase` |
| `tasks` (existing) | Kiro `tasks.md` | phases from the numbered top-level tasks (`- [ ] 1.`), their sub-tasks (`1.1`, nested or flat as cc-sdd writes them) as items, `[ ]*` optional, `[-]` open, detail bullets kept with their task | `phase` |
| `capability` (new) | OpenSpec main spec | `### Requirement:` blocks with `#### Scenario:` steps | `requirements`, `raw` |
| `delta` (new) | OpenSpec delta spec | the same, with the `ADDED` / `MODIFIED` / `REMOVED` / `RENAMED` section as the block's operation | `requirements`, `raw` |
| `requirements` (new) | Kiro `requirements.md`, `bugfix.md` | `### Requirement N: title`, `**User Story:**` (or cc-sdd's `**Objective:**`), `#### Acceptance Criteria` items split into EARS condition and response; bugfix `### … Behavior` groups of `1.1 WHEN … THEN …` items | `requirements`, `raw` |
| `proposal` (new) | OpenSpec `proposal.md` | sections | `raw` |
| `design` (new) | OpenSpec and Kiro `design.md` | sections; the `###` of a decisions or correctness-properties section as cards | `cards`, `raw` |
| `context` (new) | OpenSpec `config.yaml`, `project.md`; Kiro steering | sections; a non-markdown file is shown as code | `raw`, `code` |
| `other` (existing) | any other `.md` in a unit folder | sections | `raw` |

**One new block kind, `requirements`.** spec-kit's `stories` block is a user story with a priority, a narrative and Given / When / Then fixed in three cells. OpenSpec requirements have a SHALL statement and *named* scenarios whose steps run in order (`GIVEN`, `WHEN`, `THEN`, `AND` …), and Kiro criteria are numbered EARS sentences (`WHEN … THEN … SHALL …`, `IF …`, `WHILE …`, `WHERE …`, or a bare `THE … SHALL …`). Forcing either into `stories` would invent priorities and drop step order or numbering. The block:

```ts
{ kind: 'requirements'; heading: string; depth: number; op: string | null; text: string; items: Requirement[]; rest: string }
Requirement = { id: string | null; title: string; story: string | null; text: string; criteria: Criterion[]; rest: string }
Criterion   = { id: string | null; name: string | null; steps: { key: string; text: string }[] }
```

A step keeps its text as written; `key` is the keyword (`WHEN`, `THEN` …) or `''` for a sentence with none. Everything the parser does not place stays in a `text` or `rest` field or a `raw` block, as with every other block. `CheckItem` gets two optional fields, `optional` and `notes` (the markdown nested under a task), set only by the new task parsers.

## Page: how the UI stops assuming spec-kit

The page keeps its structure. What was a spec-kit constant becomes a field of a **flow**, one per format, in `web/flows.ts`; the spec-kit flow holds exactly the values the code had.

| Was fixed | Now |
|---|---|
| `STAGES` (six keys), `n / 6` | `flow.stages`; the count is `stages.length` (all three formats have six, the code does not rely on it) |
| stage names `n.<stage>` | the same labels, with keys for the new stages (`n.specs`, `n.propose`, `n.design`, `n.apply`, `n.archive`, `n.steering`, `n.requirements`) |
| `CMD`, `stageCommand`, `nextCommand`, `stageGuide`, `stripGuide`, `creatingCommand` | functions of the flow; the spec-kit flow is the old code moved |
| plan stage tabs (`PLAN_SUBS`) | any stage with more than one document kind shows tabs (spec-kit plan; OpenSpec propose: `proposal.md`, `specs/*/spec.md`) |
| `stage === 'constitution'` | `stages[0]`, the project stage: spec-kit keeps the principle list and version; OpenSpec lists its capabilities, Kiro its steering files; their documents open with the chooser when there are several |
| `KIND_FILE` | the same table, with per-flow names where a kind lives elsewhere (`context`: `config.yaml` / `steering/*.md`) |
| Routes `#/stage/<stage>/<unit>/<sub>` | unchanged; a stage or sub that no format knows is still the board, and a stage the current format does not have is treated the same way |
| Empty states, "no command" texts | per-flow labels where spec-kit's wording does not fit (OpenSpec has no constitution to write first; Kiro's done stage, like spec-kit's, has no command) |

### Commands shown

| Stage | spec-kit | OpenSpec 2.x (Claude Code spelling) | Kiro CLI |
|---|---|---|---|
| 1 | `/speckit.constitution` | none (specs grow when changes are archived) | none (steering is written by hand or by the IDE) |
| 2 | `/speckit.specify` | `/openspec-propose` | `/spec new <name>` |
| 3 | `/speckit.plan` | `/openspec-continue-change` | `/spec <name>` |
| 4 | `/speckit.tasks` | `/openspec-continue-change` | `/spec <name>` |
| 5 | `/speckit.implement` | `/openspec-apply-change` | `/spec run <name>` |
| 6 | none | `/openspec-archive-change` | none |

The next command for one unit carries its name where the tool takes one: `/openspec-apply-change add-due-reminders`, `/spec run tool-search`.

## CLI

- `--format <spec-kit|openspec|kiro>`: see [Detection](#detection). Shown in `--help` and the READMEs.
- The first line names the format: `spec-kit project: 7 features, 24 documents` (as before), `OpenSpec project: 7 changes, 31 documents`, `Kiro project: 6 specs, 20 documents`.
- `--demo` shows `examples/demo` as before; `--demo --format openspec` shows `examples/demo-openspec`, `--demo --format kiro` shows `examples/demo-kiro`. Both are original projects about the same made-up tool library, Borrowbox, with units at every stage. They are added to the npm package.

## Decisions taken for the owner

| Decision | Why | Cost if wrong |
|---|---|---|
| spec-kit wins when a folder matches several formats | no folder changes what it shows | a mixed folder needs `--format` |
| The format is fixed at start | one format per server keeps routes, labels and the skeleton stable | a format folder added later needs a restart |
| OpenSpec commands use the 2.x skill names, Claude Code spelling | 2.x is the current release and Claude Code is the main host; the 1.x `/opsx:*` names are in formats.md | a 1.x user or a Codex user (`$openspec-…`) translates the command |
| `/openspec-continue-change` for missing design or tasks | it is the command that creates the next artifact | it needs OpenSpec's expanded profile; core-profile users run `/openspec-propose` again or write the file |
| OpenSpec's sixth stage shows the archived change's delta specs | archiving is the merge of those deltas into the main specs | someone may expect the archived proposal; it is one tab away |
| Kiro commands are the CLI's | the IDE has buttons, not commands | IDE users ignore the commands |
| Kiro optional tasks do not count | Kiro's own run-all skips them | a team that treats them as required sees "done" early |
| cc-sdd projects are read as Kiro projects, with Kiro's commands | same folders and document shapes | cc-sdd users see `/spec …` instead of `/kiro-…` |
| One word swap for the unit noun | the labels stay one table in two languages; all three Korean nouns take the same particles | a label added later that reads badly after the swap; the test catches leftover "feature" words, not style |
| `config.yaml` is shown as code | YAML is not markdown; the tool does not parse YAML | its `context:` text is not drawn as prose |

## Out of scope

- BMad Method, Agent OS, Tessl and other formats (see formats.md for why).
- OpenSpec custom schemas (artifacts other than proposal, specs, design, tasks are `other` documents), stores, worksets and initiatives; `.openspec.yaml` metadata.
- cc-sdd's `spec.json` approvals and its commands.
- Merging delta specs into a preview of the main specs, or showing what an archive changed.
- Several formats in one view, or switching format without a restart.
- Global Kiro steering (`~/.kiro/steering/`): outside the project, so never read.
