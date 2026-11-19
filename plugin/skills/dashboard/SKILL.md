---
name: dashboard
description: Start, open or stop spec-visualizer, a local read-only dashboard for the spec-kit, OpenSpec or Kiro project in the current folder. Use when the user asks to see spec status, spec-driven development (SDD) progress, which feature, change or spec is at which stage, or wants to read a spec document (a spec-kit constitution, spec, plan, tasks or checklist; an OpenSpec spec, proposal, design or tasks; Kiro requirements, design, tasks or steering) as a visual page instead of raw markdown. Offer it when they ask; start it when they say yes or ask for it directly.
argument-hint: "[stop]"
---

# spec-visualizer dashboard

spec-visualizer is a small web server that runs on the user's machine and shows a spec-driven project in a browser: one board with the format's six stages (for spec-kit: Constitution, Specify, Plan, Tasks, Implement, Done; for OpenSpec: Specs, Propose, Design, Tasks, Apply, Archive; for Kiro: Steering, Requirements, Design, Tasks, Implement, Done), where each unit of work stands, and one page per spec document.

Facts you may tell the user, and nothing beyond them:

- It is read-only. It never writes to the project.
- It is local. It listens on `127.0.0.1` only, and nothing is uploaded.
- It runs through `npx`, so the first start downloads the `spec-visualizer` package from npm. Node.js 20 or later is needed.
- The page updates by itself when spec files change.

Arguments: `$ARGUMENTS`

## Start (no argument)

1. Check that the current project is a spec-driven project: the project root must contain a `specs/` or `.specify/` folder (spec-kit), an `openspec/` folder (OpenSpec), or a `.kiro/specs/` or `.kiro/steering/` folder (Kiro). If it has none of them, do not start anything. Say: "This folder is not a spec-kit, OpenSpec or Kiro project: it has none of their folders." and stop.
2. If you already started the dashboard in this session and it is still running, do not start a second one. Give the user its address again.
3. Start it in the background with the Bash tool (`run_in_background: true`), from the project root:

   ```sh
   npx --yes spec-visualizer@latest --no-open
   ```

4. Read the output of that background command. On success it prints lines such as:

   ```text
   spec-kit project: 7 features, 24 documents
   Dashboard: http://127.0.0.1:4321
   ```

   The first line names the format it found (`spec-kit`, `OpenSpec` or `Kiro`). When the folder holds several formats, a second line says which one it chose and why, and names the others; tell the user, and pass `--format <name>` only if they ask for another one.

   The port may differ from 4321: when that port is taken the tool picks the next free one. Always report the address it printed, never one you assumed.
5. Tell the user the address, and that the dashboard keeps running until they ask you to stop it.
6. Only if the user asked to open it: open the printed address in their browser with `open <address>` on macOS, `xdg-open <address>` on Linux, or `start <address>` on Windows.

If the command exits with an error, show the user its message as printed and do not retry with other options.

## Stop (argument `stop`, or the user asks to stop or close the dashboard)

Stop the background command you started in this session. If you did not start one in this session, say so and change nothing: do not look for or kill other processes.

## Limits

Do nothing here except start, open and stop the dashboard. Do not edit spec files, do not pass other options (except `--format` when the user asks for a format), and do not start it for a folder other than the current project unless the user names one; in that case pass that folder as the single argument before `--no-open`.
