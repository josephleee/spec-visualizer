# Security

## Reporting a problem

Please do not open a public issue for a security problem. Use **Security → Report a vulnerability** on the GitHub repository (private vulnerability reporting). Say what an attacker can do, and include the smallest project or document that shows it.

Only the latest released version is fixed.

## What the tool promises

spec-visualizer is a local, read-only viewer. These are its boundaries, and a way around any of them is a security bug:

- **Local only.** The server listens on `127.0.0.1` and answers only requests whose `Host` header is `127.0.0.1:<port>` or `localhost:<port>`, so another machine or a web page using DNS rebinding cannot read the project.
- **Read-only.** It accepts only `GET`, and never writes to the project it shows.
- **Only the scanned files.** It serves the spec documents its scan found under `specs/` and `.specify/`, the first paragraph of the root `README.md`, and its own web files. It does not follow symbolic links, and a path outside that set is a 404.
- **Document content is untrusted.** A spec file may come from someone else's repository. Raw HTML in markdown is shown as text and never run, images are not loaded, and HTML comments are hidden.
- **Nothing leaves the machine.** No telemetry, no network requests by the server. The "new" and "changed" marks live in the browser's local storage.

## What is out of scope

- Anyone who can already run programs as you, or read your files, on the same machine.
- The contents of your own spec files being visible to you in your own browser.
- `npx` downloading the package from npm: verify the package with its provenance statement on npmjs.com if you need to.
