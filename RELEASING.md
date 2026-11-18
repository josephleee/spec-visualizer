# Releasing

## Versioning

spec-visualizer follows semantic versioning. A major version is needed when something a user or a script relies on stops working:

- a CLI flag or its meaning is removed or changed,
- the default port or the printed `Dashboard:` line changes,
- the shape of the `/api/project`, `/api/doc` or `/api/events` responses changes incompatibly,
- the oldest supported Node.js version is raised,
- a document that used to be drawn as one form is now read differently (drawing a form that used to fall back to plain markdown is not breaking).

New flags, new document forms and new API fields are minor. Fixes are patch. Before 1.0.0, breaking changes may land in a minor version and are called out in the changelog. The plugin and the marketplace entry always carry the same version as the npm package.

## Steps

1. Make sure `CHANGELOG.md` has the changes under `## [Unreleased]`.
2. On `main`, with a clean tree, run `npm version patch` (or `minor`, `major`, or `preminor --preid rc` for a pre-release). This runs the tests, updates the plugin and marketplace versions, stamps the changelog, commits and tags.
3. Run `git push --follow-tags`.

The tag starts the Release workflow. It tests, builds, checks the packed tarball, publishes it to npm with provenance and creates the GitHub release from the changelog section. Pre-release versions go to the `next` dist-tag (`npx spec-visualizer@next`). Re-running a failed release is safe.

The changelog section of the version must have text in it: the workflow stops before publishing when it is empty.

## Publishing setup

The Release workflow publishes through npm trusted publishing (OIDC). There is no npm token, in the repository or anywhere else: npm exchanges the identity of the workflow run for a publish token that lasts for that run only, and attaches a provenance statement because the repository and the package are public.

What is configured:

- On npm, the package `spec-visualizer` trusts GitHub Actions for repository `josephleee/spec-visualizer`, workflow file `release.yml`, no environment, with permission to publish. It was registered on 2026-11-18 with `npm trust github spec-visualizer --file release.yml --repo josephleee/spec-visualizer --allow-publish`, approved in the browser by the package owner.
- In `.github/workflows/release.yml`, the job has `id-token: write`, runs on a GitHub-hosted runner with Node 24 (trusted publishing needs Node 22.14 and npm 11.5.1 or later), and sets no `NODE_AUTH_TOKEN`.
- `repository.url` in `package.json` names the same GitHub repository. npm rejects the provenance statement when it does not.

Things that break it: renaming `release.yml`, renaming or moving the repository, or publishing from another workflow file. npm compares these values exactly and reports a mismatch only when a publish is tried. To see or replace the configuration, run `npm trust list spec-visualizer` and `npm trust revoke spec-visualizer --id <id>` (both ask for two-factor approval in the browser), or open the package on npmjs.com, Settings, Trusted publishing. A package has one configuration at a time. npm removes a new configuration that has not published successfully within 2 days of being created.

Publishing by hand with `npm publish` still works for the package owner and asks for two-factor approval.

If `npm version` stops because the changelog has no Unreleased section, add it, run `git checkout package.json package-lock.json`, and try again.
