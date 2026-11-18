# Changelog

## [Unreleased]

## [0.1.1-rc.0] - 2026-11-18

- Releases are published from GitHub Actions through npm trusted publishing, without a stored token.

## [0.1.0] - 2026-11-18

The first version.

### Dashboard

- A board with six stage cards (Constitution, Specify, Plan, Tasks, Implement, Done): the features standing at each stage, the documents each stage leaves, and the next command to type, with a copy button.
- A project strip with the project name, the first paragraph of its README, task progress, finished features and the next command.
- One page per stage document, each drawn for its kind:
  - constitution: principle plates, version, ratified and amended dates
  - spec: user stories, Given / When / Then scenarios, requirement groups, success criteria, open questions
  - plan: summary, technical context, constitution check, project structure
  - research: decisions beside their rejected alternatives
  - data model: entity cards
  - quickstart: numbered steps
  - tasks: phase structure at the Tasks stage, progress at the Implement stage
  - checklists: items by group
- Guidance when a document does not exist yet: where the feature is and which command creates the document.
- Live updates when files change, without reloading.
- "New" and "changed" marks for documents since they were last opened, kept in the browser.
- Korean and English labels; light and dark by the system setting.
- The reading position is kept per history entry.

### Reading documents

- Both user story styles: `User Story N - Title (Priority: P1)` with one-line scenarios, and `US-N: Title` with a narrative and one clause per list item.
- Content that matches no rule is kept and shown as markdown; nothing in a document is dropped. HTML comments are hidden.
- Documents that do not follow the template are shown in their own order.
- Long documents are parsed in pieces, and unchanged files are not parsed again.

### Command line

- `npx spec-visualizer [path]`, with `--port`, `--demo`, `--no-open`, `--help` and `--version`.
- A bundled example project for `--demo`.
- The default port moves on to the next free one when taken.

### Claude Code plugin

- A plugin with one skill, `/spec-visualizer:dashboard`, that starts, opens and stops the dashboard.

### Security

- Local and read-only: the server listens on `127.0.0.1`, checks the `Host` header, accepts only `GET`, and serves only the documents its scan found.
- Symbolic links are never followed out of the project.
- Raw HTML in documents is shown as text, images are not loaded, and only `http`, `https` and `#` links can be followed.
