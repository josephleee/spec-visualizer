**What this changes and why**

**How it was checked**

- [ ] `npm test`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`
- [ ] Looked at it in the browser with `npm start -- --demo` (for anything visible)

**The two rules** (see CONTRIBUTING.md)

- [ ] No content is dropped: text a page does not draw is still shown somewhere
- [ ] Nothing moves after it appears
- [ ] The server still writes nothing and serves only what the scan found

A line for `CHANGELOG.md` under "Unreleased", if a user would notice the change:
