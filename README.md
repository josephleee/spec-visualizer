# spec-visualizer

A local, read-only dashboard for a [GitHub spec-kit](https://github.com/github/spec-kit) project.
It shows each feature's stage and turns every spec document into a page that fits its kind, instead of plain rendered markdown.

## Requirements

Node.js 24 or later.

## Run

```sh
npm install && npm run build && node server/cli.ts <path-to-spec-kit-project>
```

Then open the address it prints (`http://127.0.0.1:4321` by default). Without a path it uses the current folder. The folder must contain `specs/` or `.specify/`.

The page updates by itself when files change. The UI is in English or Korean (the button in the top bar switches).

### Options

| Option | Default | Meaning |
|---|---|---|
| `--port <n>` | `4321` | Port to listen on. If it is taken, the tool says so and exits. |

## Read-only

spec-visualizer never writes to the project it shows. It listens on `127.0.0.1` only, answers only requests whose `Host` is `127.0.0.1:<port>` or `localhost:<port>`, and serves only the files its scan found. Raw HTML inside markdown is shown as text, never run, and HTML comments are hidden.

The "new" and "changed" marks are kept in your browser's local storage, per project folder. The first time a project is opened, every document counts as already seen.

## What each document becomes

| Kind | File | Shown as |
|---|---|---|
| spec | `specs/<feature>/spec.md` | User story cards by priority with Given / When / Then scenarios, requirement and success-criteria lists, open questions (`NEEDS CLARIFICATION`) highlighted |
| plan | `specs/<feature>/plan.md` | Technical Context as a field table; other sections as markdown |
| tasks | `specs/<feature>/tasks.md` | Overall progress, phases with their own progress, parallel `[P]` marks, a filter by user story |
| research | `specs/<feature>/research.md` | Decision cards: the decision, its rationale, the alternatives |
| data-model | `specs/<feature>/data-model.md` | Entity cards |
| checklist | `specs/<feature>/checklists/*.md` | Items by category with progress |
| quickstart | `specs/<feature>/quickstart.md` | Markdown |
| contract | `specs/<feature>/contracts/*` | Markdown for `.md`, a code view for anything else |
| constitution | `.specify/memory/constitution.md` | Principle cards; the version on the home screen |
| other | any other `.md` in a feature folder | Markdown |

The home screen shows, per feature, its stage (Specify, Plan, Tasks, Implement, Done), which documents exist and which of spec, plan and tasks are missing, task progress and open questions. The feature whose folder name matches the current git branch is listed first and marked current.

A section that does not match the template is shown as markdown in its place; nothing is dropped.

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
