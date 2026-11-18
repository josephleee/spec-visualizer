# spec-visualizer

A local, read-only dashboard for a [GitHub spec-kit](https://github.com/github/spec-kit) project.
It lays the six spec-driven stages out on one board, shows which feature stands where and what to type next, and turns every spec document into a page that fits its kind, instead of plain rendered markdown.

## Requirements

Node.js 24 or later.

## Run

```sh
npm install && npm run build && node server/cli.ts <path-to-spec-kit-project>
```

Then open the address it prints (`http://127.0.0.1:4321` by default). Without a path it uses the current folder. The folder must contain `specs/` or `.specify/`.

The page updates by itself when files change. The UI is in Korean or English (the switch at the right of the top strip), and follows the system light or dark setting.

### Options

| Option | Default | Meaning |
|---|---|---|
| `--port <n>` | `4321` | Port to listen on. If it is taken, the tool says so and exits. |

## Read-only

spec-visualizer never writes to the project it shows. It listens on `127.0.0.1` only, answers only requests whose `Host` is `127.0.0.1:<port>` or `localhost:<port>`, and serves only the files its scan found. Raw HTML inside markdown is shown as text, never run, and HTML comments are hidden.

The "new" and "changed" marks are kept in your browser's local storage, per project folder. The first time a project is opened, every document counts as already seen.

## The board

The first screen is one board with six stage cards: Constitution, Specify, Plan, Tasks, Implement, Done. Each card shows what the stage is for, its command, how many features stand there and how many have passed, the features standing there as links, the documents the stage leaves, and the next command for those features with a copy button. The Constitution card lists the principles. A stage holding a feature with unfinished tasks is drawn in green.

The dark strip above it names the project (with the first paragraph of its `README.md`), the share of tasks done, the features finished and the next command for the feature in progress.

A feature whose documents are new or changed since you last opened them carries a mark.

## Stage pages

Clicking a card or a feature zooms into that stage's document (`#/stage/<stage>/<feature>`). The bar on top goes back to the board, jumps between the six stages and switches the feature; the index on the left follows the section you are reading. If the feature has not reached the stage yet, the page says where the feature is and which command creates the document.

| Stage | File | Shown as |
|---|---|---|
| 1 Constitution | `.specify/memory/constitution.md` | Numbered principle plates; version, ratified and amended dates; field sheets |
| 2 Specify | `specs/<feature>/spec.md` | Counts, user stories with priority and narrative, each scenario as Given → When → Then, requirement groups with a size bar, success criteria, open questions (`NEEDS CLARIFICATION`) |
| 3 Plan | `specs/<feature>/plan.md` | Summary, Technical Context as a sheet of fields, tables as tables, trees as code |
| | `research.md` | Each decision beside the alternatives it rejected |
| | `data-model.md` | Entity cards |
| | `quickstart.md` | Its sections as numbered steps |
| | `contracts/*` | Markdown for `.md`, a code view for anything else |
| 4 Tasks | `specs/<feature>/tasks.md` | Structure: phases, one mark per task (filled = done, outline = open), parallel `[P]` tasks stacked, story tags, the task text on demand |
| 5 Implement | the same `tasks.md` | Progress: done of total, every task as a cell, what is left per phase and per story, the next command. Green marks only what is next |
| 6 Done | `specs/<feature>/checklists/*.md` | Items by group with counts; a chooser when there are several checklists |

Any other `.md` in a feature folder is an `other` document: it is linked from the feature's pages and shown section by section (`#/doc/<path>`). Outside `contracts/`, only `.md` files are read: in the demo fixture, `specs/001-login/analysis.md` is an `other` document and `notes.txt` is ignored.

Nothing is dropped: parts of a document that a page does not draw are listed under a disclosure at its end, and a document that does not follow the template is shown in its own order.

## What it does not do

- Edit documents or tick checkboxes
- Highlight what changed inside an updated document
- Read other formats (OpenSpec, Kiro and so on)
- Show several projects at once
- Generate pages with AI
- Export static HTML, host the dashboard or log users in
- Draw entity relationships as a graph

## Development

```sh
npm test            # vitest
npx tsc --noEmit    # type check
npm run build       # web files into dist/web, which the server serves
```
