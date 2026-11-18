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

If `npm version` stops because the changelog has no Unreleased section, add it, run `git checkout package.json package-lock.json`, and try again.
