# Contributing

Thanks for helping. This is a small tool with a narrow job: show a spec-driven project (spec-kit, OpenSpec or Kiro), read-only, on the user's own machine.

## Set up

Node.js 24 or later for development (the published package runs on Node.js 20 or later).

```sh
git clone https://github.com/josephleee/spec-visualizer.git
cd spec-visualizer
npm install
npm test              # vitest
npx tsc --noEmit      # type check
npm run build         # web files into dist/web, the server as JavaScript into dist/server
```

## Run from source

```sh
npm run build                      # once, and again after a change under web/
npm start -- --demo                # the bundled example project
npm start -- <path-to-a-project>   # a spec-kit, OpenSpec or Kiro project of your own
```

`npm start` runs the TypeScript sources in `server/` directly. For work on the page, `npm run dev` starts Vite with hot reload next to a running `npm start`.

## Where things are

| Folder | What |
|---|---|
| `server/` | The scan, the parsers and the HTTP server; one adapter per format in `formats.ts`, `openspec.ts`, `kiro.ts` |
| `web/` | The React page; each format's stages and commands in `flows.ts` |
| `test/` | Tests; `test/fixtures/demo` is a small project for them, `test/golden/` the recorded spec-kit output |
| `examples/demo/`, `examples/demo-openspec/`, `examples/demo-kiro/` | The projects `--demo` shows, per format. Keep them original and keep every document form in them |
| `plugin/` | The Claude Code plugin |

## Two rules for every change

1. **Never drop content.** Whatever is in a document must be visible somewhere. When a parser does not recognise a part, it stays as written (a `raw` block or a `rest` field) and the page shows it; only HTML comments are hidden. A change that draws one form more nicely must not make another form disappear.
2. **Nothing moves after it appears.** Once something is on screen it stays where it is: no layout shift when data arrives, when a mark is added or when the section index fills in. Reserve the space first.

spec-kit output must not change by accident: `test/speckit-golden.test.ts` compares the server's JSON and every page's HTML for both spec-kit projects with `test/golden/`. Run it with `UPDATE_GOLDEN=1` only in a commit whose purpose is to change that output, and say so in the commit.

And the boundaries in [SECURITY.md](SECURITY.md) hold for every change: the server binds `127.0.0.1`, checks the `Host` header, serves only what the scan found, follows no symbolic links and writes nothing.

## Pull requests

- Write the test first for parser and CLI logic; a document that was drawn wrongly becomes a test case.
- One change per pull request, with a [conventional commit](https://www.conventionalcommits.org) message (`fix:`, `feat:`, `docs:` …).
- Add a line under "Unreleased" in `CHANGELOG.md` when a user would notice the change.
- No new runtime dependency without a reason in the description: the package installs through `npx`, so its size is felt on every first run.
