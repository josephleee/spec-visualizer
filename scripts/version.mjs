// Run by `npm version` after it has written the new version to package.json.
// Copies that version to the plugin manifest and the marketplace entry, and stamps the changelog.
import fs from 'node:fs'

const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'))

// Checked before anything is written. "## [Unreleased]" becomes the section of this version, under a new empty one.
let log = fs.readFileSync('CHANGELOG.md', 'utf8')
const has = (name) => log.split('\n').some((l) => l.startsWith('## ') && l.split(/\s+/)[1].replace(/[\[\]]/g, '') === name)
if (!has(version)) {
  if (!has('Unreleased')) {
    console.error(`CHANGELOG.md has no "## [Unreleased]" or "## [${version}]" section. Add one, undo this attempt with "git checkout package.json package-lock.json", and run npm version again.`)
    process.exit(1)
  }
  const today = new Date().toISOString().slice(0, 10)
  log = log.replace(/^## \[?Unreleased\]?.*$/m, `## [Unreleased]\n\n## [${version}] - ${today}`)
}
fs.writeFileSync('CHANGELOG.md', log)

// The first "version" key in each file; a text replace keeps the file's formatting.
for (const file of ['plugin/.claude-plugin/plugin.json', '.claude-plugin/marketplace.json']) {
  const text = fs.readFileSync(file, 'utf8')
  if (!/"version":\s*"[^"]*"/.test(text)) throw new Error(`${file} has no "version" to update`)
  fs.writeFileSync(file, text.replace(/("version":\s*")[^"]*"/, `$1${version}"`))
}
