import { expect, test } from 'vitest'
import fs from 'node:fs'

const json = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))

// `npm version` keeps these in step (scripts/version.mjs); a hand edit of one of them fails here.
test('package.json, the plugin manifest and the marketplace entry carry the same version', () => {
  const version = json('package.json').version
  expect(version).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/)
  expect(json('plugin/.claude-plugin/plugin.json').version).toBe(version)
  const entry = json('.claude-plugin/marketplace.json').plugins.find((p: { name: string }) => p.name === 'spec-visualizer')
  expect(entry.version).toBe(version)
})
