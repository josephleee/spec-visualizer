// spec-kit output must not change: the JSON the server sends and the HTML the page draws for the two spec-kit
// projects in this repository are compared with what the version before the format layer produced.
// UPDATE_GOLDEN=1 writes the files instead; do that only on a commit whose spec-kit output is the reference.
// UPDATE_GOLDEN=<name> writes one project's files only, for a project added later; the others are left as recorded.
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ParsedDoc, Project } from '../server/types.ts'
import { startServer } from '../server/server.ts'

const update = process.env.UPDATE_GOLDEN
const goldenDir = path.join(import.meta.dirname, 'golden')
const webDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specviz-golden-'))
fs.writeFileSync(path.join(webDir, 'index.html'), '<h1>hi</h1>')
afterAll(() => fs.rmSync(webDir, { recursive: true, force: true }))

// wide: a constitution with 11 principles and a feature with 13 contracts, added after the format layer to pin the two
// shapes whose drawing changed on purpose (see docs/design-formats.md, "How spec-kit is kept the same").
const projects = { fixture: 'test/fixtures/demo', example: 'examples/demo', wide: 'test/fixtures/wide' } as const
type Name = keyof typeof projects
type Captured = { project: string; docs: Record<string, string> }
const captured = {} as Record<Name, Captured>

beforeAll(async () => {
  for (const [name, rel] of Object.entries(projects) as [Name, string][]) {
    const root = path.resolve(rel)
    const srv = await startServer({ root, port: 0, webDir })
    try {
      const get = async (url: string) => (await fetch(`http://127.0.0.1:${srv.port}${url}`)).text()
      const project = await get('/api/project')
      const p = JSON.parse(project) as Project
      const docs: Record<string, string> = {}
      for (const r of [...(p.constitution ? [p.constitution] : []), ...p.features.flatMap((f) => f.docs)])
        docs[r.path] = await get(`/api/doc?path=${encodeURIComponent(r.path)}`)
      captured[name] = { project: project.split(JSON.stringify(root).slice(1, -1)).join('<root>'), docs }
    } finally {
      await srv.close()
    }
  }
})

function golden(file: string, value: string) {
  const at = path.join(goldenDir, file)
  if (update === '1' || (update && file.startsWith(`${update}.`))) { fs.mkdirSync(goldenDir, { recursive: true }); fs.writeFileSync(at, value); return }
  expect(value, file).toBe(fs.readFileSync(at, 'utf8'))
}

for (const name of Object.keys(projects) as Name[]) {
  test(`${name}: /api/project and every /api/doc are byte for byte the same`, () => {
    const c = captured[name]
    golden(`${name}.api.json`, JSON.stringify({ project: JSON.parse(c.project), docs: Object.fromEntries(Object.entries(c.docs).map(([k, v]) => [k, JSON.parse(v)])) }, null, 1) + '\n')
    // The pretty file is for reading; the strings themselves must match too, key order included.
    golden(`${name}.api.sha1`, crypto.createHash('sha1').update(c.project + Object.values(c.docs).join('\0')).digest('hex') + '\n')
  })

  test(`${name}: the strip, the board and every page draw the same HTML in both languages`, async () => {
    const c = captured[name]
    const project = { ...JSON.parse(c.project), root: '/golden' } as Project
    const pages: Record<string, string> = {}
    for (const lang of ['en', 'ko'] as const) {
      vi.resetModules()
      vi.stubGlobal('localStorage', { getItem: (k: string) => (k === 'specviz:lang' ? lang : null), setItem: () => {} })
      const { Strip } = await import('../web/Strip.tsx')
      const { Board } = await import('../web/Board.tsx')
      const { StagePage } = await import('../web/StagePage.tsx')
      const route = await import('../web/route.ts')
      const seen = Object.fromEntries([project.constitution, ...project.features.flatMap((f) => f.docs)].filter((d) => !!d).map((d) => [d!.path, d!.hash]))
      const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el)
      pages[`${lang} strip`] = html(createElement(Strip, { project }))
      pages[`${lang} board`] = html(createElement(Board, { project, seen }))
      const routes: string[] = []
      for (const stage of route.STAGES) for (const f of [null, ...project.features.map((x) => x.id)]) {
        routes.push(route.stageHref(stage, f))
        if (stage === 'plan' && f) for (const sub of route.PLAN_SUBS) routes.push(route.stageHref(stage, f, sub))
      }
      for (const d of [project.constitution, ...project.features.flatMap((f) => f.docs)]) if (d) routes.push(route.formatRoute({ kind: 'doc', path: d.path }))
      for (const hash of routes) {
        const r = route.parseRoute(hash)
        if (r.kind === 'board') continue
        const ref = route.resolveTarget(project, r).refs[0] ?? null
        const doc = ref && !ref.error ? JSON.parse(c.docs[ref.path]) as ParsedDoc : null
        const view = { route: r, entry: 'e', path: ref && !ref.error ? ref.path : null, doc: ref ? doc : null, failed: false }
        pages[`${lang} ${hash}`] = html(createElement(Fragment, null, createElement(StagePage, { view, asked: r, project, seen, onSeen: () => {}, onPick: () => {} })))
      }
    }
    vi.unstubAllGlobals()
    if (name === 'wide') { // the two intended changes, stated here as well as in the hashes
      expect(pages['en board']).toContain('class="pr wide"')
      expect(pages['en #/stage/plan/001-gateway/contract']).toContain('<select')
    }
    const sums = Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, crypto.createHash('sha1').update(v).digest('hex')]))
    golden(`${name}.html.json`, JSON.stringify(sums, null, 1) + '\n')
  })
}
