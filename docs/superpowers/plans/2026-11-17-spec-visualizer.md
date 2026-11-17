# spec-visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** spec-kit 프로젝트 폴더에서 명령 하나로 뜨는 읽기 전용 로컬 대시보드를 만든다. 홈 화면은 기능별 단계와 문서 현황을, 문서 페이지는 문서 종류별 전용 화면을 보여준다.

**Architecture:** Node 서버가 `specs/`와 `.specify/`를 읽어 JSON 모델로 만들고, React 화면이 그 모델만 그린다. 파싱은 서버에서만 한다. 파일이 바뀌면 서버가 SSE로 알리고 화면이 모델을 다시 받는다.

**Tech Stack:** Node 24 이상(TypeScript를 빌드 없이 직접 실행), `unified` + `remark-parse` + `remark-gfm`, React 18, Vite, `react-markdown`, Vitest. 그 밖의 런타임 의존성은 추가하지 않는다.

**Spec:** `docs/superpowers/specs/2026-11-16-spec-visualizer-design.md` (결정 12개의 답 포함). 화면 스케치는 `docs/superpowers/plans/spec-visualizer-plan.html`.

## Global Constraints

- 읽기 전용이다. 프로젝트 폴더에 어떤 파일도 쓰지 않는다.
- 서버는 `127.0.0.1`에만 바인딩한다. `Host` 헤더가 `127.0.0.1:<port>` 또는 `localhost:<port>`가 아니면 403을 준다.
- `/api/doc`은 스캔으로 찾은 경로만 준다. 그 밖의 경로는 404다.
- 마크다운 안의 원시 HTML은 실행하지 않는다. `rehype-raw`를 쓰지 않는다. `dangerouslySetInnerHTML`을 쓰지 않는다.
- HTML 주석은 표시하지 않는다. 그 밖의 내용은 인식하지 못해도 반드시 화면에 나온다.
- 서버 코드는 `.ts` 확장자를 붙여 import한다. `enum`과 생성자 매개변수 속성을 쓰지 않는다(Node의 타입 제거로 실행하기 때문이다).
- 기본 포트는 `4321`이다.
- localStorage 키는 `specviz:seen:<프로젝트 절대 경로>`와 `specviz:lang`이다. 모든 읽기/쓰기를 try/catch로 감싼다.
- 화면 라벨은 영어와 한국어 두 벌이다. 문서에서 읽은 내용은 번역하지 않는다.
- 테스트 샘플은 직접 쓴다. 남의 저장소 파일을 복사해 넣지 않는다.
- 커밋은 사용자가 허락한 뒤에만 한다. 허락을 받으면 `master`가 아닌 작업 브랜치에서 한다.

## Review Focus

1. **CRLF 줄바꿈과 BOM이 있는 파일**: 표식을 똑같이 읽어야 한다. → Task 1
2. **빈 파일, 제목만 있는 파일**: 오류 없이 빈 페이지가 나와야 한다. → Task 4
3. **`[X]` 대문자 체크와 들여쓴 하위 체크박스**: 둘 다 세야 한다. → Task 1
4. **열어둔 문서가 삭제되거나 이름이 바뀜**: 페이지가 깨지지 않고 "문서가 없어졌다"와 홈 링크를 보여야 한다. → Task 8
5. **`specs/` 안에서 프로젝트 밖을 가리키는 심볼릭 링크**: 따라가지 않아야 한다. → Task 5

## File Structure

```
package.json            scripts, 의존성, engines
tsconfig.json           noEmit, allowImportingTsExtensions, jsx
vite.config.ts          root=web, outDir=dist/web, /api 프록시, vitest 설정
server/
  types.ts              서버와 화면이 함께 쓰는 타입 (런타임 코드 없음)
  md.ts                 마크다운 공통 도구: 주석 제거, 제목 분할, 라벨 추출, 체크박스
  parsers.ts            종류별 파서와 parseDoc
  scan.ts               프로젝트 스캔: 문서 종류, 해시, 단계, 집계, 현재 기능
  server.ts             HTTP 라우트, SSE, 파일 감시
  cli.ts                인자 처리, 시작 메시지, 오류 종료
web/
  index.html
  main.tsx              진입점, 해시 라우팅
  live.ts               모델 가져오기와 SSE 재연결
  i18n.ts               라벨 표와 언어 전환
  seen.ts               새 문서/갱신 표시
  Home.tsx              홈 화면
  DocPage.tsx           문서 페이지: 블록 종류별 컴포넌트
  Markdown.tsx          react-markdown 래퍼
  styles.css
test/
  md.test.ts  parsers.test.ts  scan.test.ts  server.test.ts  seen.test.ts
```

파서를 파일 하나에 둔 것은 일곱 파서가 `md.ts`의 같은 도구 네 개를 조합한 짧은 함수이기 때문이다. 300줄을 넘으면 종류별로 나눈다.

---

### Task 1: 프로젝트 뼈대, 타입, 마크다운 도구

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `server/types.ts`, `server/md.ts`
- Test: `test/md.test.ts`

**Interfaces:**
- Produces (`server/types.ts`):

```ts
export type Stage = 'specify' | 'plan' | 'tasks' | 'implement' | 'done'
export type DocKind = 'spec' | 'plan' | 'tasks' | 'constitution' | 'checklist'
  | 'research' | 'data-model' | 'quickstart' | 'contract' | 'other'
export type DocRef = { path: string; kind: DocKind; hash: string; error?: string }
export type Feature = {
  id: string; stage: Stage; docs: DocRef[]
  tasks: { done: number; total: number } | null
  openQuestions: number
}
export type Project = {
  root: string; name: string
  constitution: DocRef | null; constitutionVersion: string | null
  currentFeature: string | null; features: Feature[]
}
export type Field = { label: string; value: string }            // value는 마크다운
export type CheckItem = { id: string | null; done: boolean; parallel: boolean; story: string | null; text: string }
export type Scenario = { given: string; when: string; then: string }
export type Block =
  | { kind: 'raw'; heading: string | null; depth: number; markdown: string }
  | { kind: 'stories'; items: { title: string; priority: string | null; why: string | null; test: string | null; scenarios: Scenario[]; rest: string }[] }
  | { kind: 'idList'; heading: string; items: { id: string; text: string }[]; rest: string }
  | { kind: 'phase'; title: string; fields: Field[]; items: CheckItem[]; rest: string }
  | { kind: 'fields'; heading: string; items: Field[]; rest: string }
  | { kind: 'cards'; heading: string; items: { title: string; markdown: string }[] }
  | { kind: 'decisions'; items: { title: string; fields: Field[]; rest: string }[] }
  | { kind: 'code'; lang: string; text: string }
export type ParsedDoc = { ref: DocRef; title: string | null; meta: Field[]; blocks: Block[] }
```

`rest`는 그 블록 안에서 인식하지 못한 부분의 마크다운이다. 비어 있으면 `''`이다. `phase`는 tasks의 단계와 checklist의 범주에 함께 쓴다. `cards`는 constitution의 원칙과 data-model의 엔티티에 함께 쓴다.

- Produces (`server/md.ts`):

```ts
export type Node = import('mdast').RootContent
export type Sec = { heading: string | null; depth: number; nodes: Node[] }
export function clean(src: string): string                     // BOM 제거, CRLF→LF, HTML 주석 제거
export function parse(src: string): Node[]                      // remark-parse + remark-gfm
export function slice(src: string, nodes: Node[]): string       // 노드 범위의 원문 마크다운
export function splitAt(nodes: Node[], depth: number): Sec[]    // 첫 제목 앞 부분은 heading: null
export function takeLabels(src: string, nodes: Node[]): { fields: Field[]; rest: Node[] }
export function checkItems(nodes: Node[]): CheckItem[]
export function headingText(node: Node): string
```

`clean`은 mdast의 `html` 노드 중 값이 `<!--`로 시작해 `-->`로 끝나는 것의 위치 범위를 원문에서 잘라낸다. 정규식으로 원문 전체를 치환하지 않는다(코드 블록 안의 주석은 내용이다).

`takeLabels`는 `**Label**: value`로 시작하는 문단을 라벨의 시작으로 본다. 한 문단에 `**A**: x | **B**: y`처럼 여럿이 있으면 각각 나눈다. 값은 다음 라벨 문단 직전까지의 노드 전부다(목록 포함). 첫 라벨 앞의 노드는 `rest`로 간다.

`checkItems`는 `checked`가 `null`이 아닌 모든 `listItem`을 깊이와 상관없이 모은다. 본문 앞에서 `/^([A-Z]+\d+)\s+/`로 ID를, `[P]`로 병렬을, `/\[(US\d+)\]/`로 스토리를 읽고 본문에서 뺀다.

- [ ] **Step 1: 뼈대를 만든다**

`package.json`: `"type": "module"`, `"engines": { "node": ">=24" }`, `"bin": { "spec-visualizer": "server/cli.ts" }`. scripts: `"start": "node server/cli.ts"`, `"dev": "vite"`, `"build": "vite build"`, `"test": "vitest run"`. dependencies: `unified`, `remark-parse`, `remark-gfm`, `react`, `react-dom`, `react-markdown`. devDependencies: `vite`, `@vitejs/plugin-react`, `vitest`, `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/mdast`.

`vite.config.ts`: `root: 'web'`, `build.outDir: '../dist/web'`, `build.emptyOutDir: true`, `server.proxy: { '/api': 'http://127.0.0.1:4321' }`, `test: { root: '.', include: ['test/**/*.test.ts'] }`.

`.gitignore`: `node_modules`, `dist`.

Run: `npm install`
Expected: 오류 없이 끝난다.

- [ ] **Step 2: 실패하는 테스트를 쓴다** (`test/md.test.ts`)

```ts
import { expect, test } from 'vitest'
import { clean, parse, slice, splitAt, takeLabels, checkItems } from '../server/md.ts'

test('clean removes comments, BOM and CRLF but keeps comments in code', () => {
  const src = '﻿# T\r\n<!-- note -->\r\ntext <!-- x --> more\r\n```\n<!-- keep -->\n```\n'
  const out = clean(src)
  expect(out).not.toContain('note')
  expect(out).not.toContain('<!-- x -->')
  expect(out).toContain('<!-- keep -->')
  expect(out).not.toContain('\r')
  expect(out.startsWith('# T')).toBe(true)
})

test('splitAt keeps every node and the preamble', () => {
  const src = 'intro\n\n## A\n\na1\n\n### A.1\n\nx\n\n## B\n\nb1\n'
  const secs = splitAt(parse(src), 2)
  expect(secs.map((s) => s.heading)).toEqual([null, 'A', 'B'])
  expect(slice(src, secs[1].nodes)).toContain('### A.1')
})

test('takeLabels splits label paragraphs and keeps the rest', () => {
  const src = 'before\n\n**Decision**: use which\n\n**Rationale**:\n\n- fast\n- small\n\n**Version**: 1.2.0 | **Ratified**: 2025-06-13\n'
  const { fields, rest } = takeLabels(src, parse(src))
  expect(fields.map((f) => f.label)).toEqual(['Decision', 'Rationale', 'Version', 'Ratified'])
  expect(fields[0].value).toBe('use which')
  expect(fields[1].value).toContain('- small')
  expect(fields[3].value).toBe('2025-06-13')
  expect(slice(src, rest)).toBe('before')
})

test('checkItems counts with or without an ID, uppercase X, and nested items', () => {
  const src = '- [x] T001 Create structure\n- [ ] T012 [P] [US1] Create model\n- [X] No implementation details\n  - [ ] nested\n- plain bullet\n'
  const items = checkItems(parse(src))
  expect(items).toHaveLength(4)
  expect(items[0]).toEqual({ id: 'T001', done: true, parallel: false, story: null, text: 'Create structure' })
  expect(items[1]).toMatchObject({ id: 'T012', done: false, parallel: true, story: 'US1', text: 'Create model' })
  expect(items[2]).toMatchObject({ id: null, done: true })
})
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npm test -- test/md.test.ts`
Expected: FAIL, `server/md.ts`가 없다는 오류.

- [ ] **Step 4: `server/types.ts`와 `server/md.ts`를 위 인터페이스대로 구현한다**

- [ ] **Step 5: 통과를 확인한다**

Run: `npm test -- test/md.test.ts`
Expected: 4 passed.

- [ ] **Step 6: 커밋한다** (`feat: scaffold project and markdown helpers`)

---

### Task 2: spec.md 파서

**Files:**
- Create: `server/parsers.ts`
- Test: `test/parsers.test.ts`

**Interfaces:**
- Consumes: Task 1의 `md.ts` 전부와 `types.ts`
- Produces: `export function parseSpec(src: string): Block[]`, 그리고 내부 도구 `function rawBlock(src: string, sec: Sec): Block`(다른 파서가 함께 쓴다)

규칙:
- 종류별 파서(`parseSpec` 등)는 첫 `##` 앞의 내용(`#` 제목과 머리말)을 다루지 않고 버린다. 그 부분은 Task 4의 `parseDoc`이 `title`, `meta`, 맨 앞 `raw` 블록으로 처리한다.
- `##` 단위로 나눈다. 각 `##` 구역 안을 다시 `###`으로 나눈다.
- `### User Story N - 제목 (Priority: P1)`에 맞는 `###` 구역이 이어지면 `stories` 블록 하나로 묶는다. 제목 정규식: `/^User Story\s+\d+\s*[-–—:]\s*(.+?)(?:\s*\(Priority:\s*(\w+)\))?$/`.
- 스토리 안에서 `takeLabels`로 `Why this priority`→`why`, `Independent Test`→`test`를 읽는다. `Acceptance Scenarios` 값 안의 목록 항목 중 `**Given** … **When** … **Then** …` 꼴은 `scenarios`로, 그 밖은 `rest`로 보낸다.
- `**FR-001**: 본문` 또는 `**SC-001**: 본문` 꼴의 목록 항목이 있는 `###` 구역은 `idList`가 된다. 맞지 않는 항목과 그 밖의 노드는 `rest`로 간다.
- 나머지 모든 구역(Edge Cases, Key Entities, Assumptions 포함)은 `raw`다. 원래 순서를 지킨다.
- `##` 구역에 `###`이 없고 내용만 있으면 `raw` 하나다. `##` 제목과 첫 `###` 사이의 내용도 `raw`로 남긴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { expect, test } from 'vitest'
import { parseSpec } from '../server/parsers.ts'

const SPEC = `# Feature Specification: Pager

## User Scenarios & Testing

### User Story 1 - Configure pager (Priority: P1)

Users set a pager.

**Why this priority**: Core value.

**Independent Test**: Set config and run.

**Acceptance Scenarios**:

1. **Given** a config, **When** output is long, **Then** less opens
2. A scenario in free text

### Edge Cases

- What if less is missing?

## Requirements

### Functional Requirements

- **FR-001**: System MUST read the pager
- **FR-006**: System MUST use [NEEDS CLARIFICATION: which default?]
- a line with no id

## Migration Notes

Old configs keep PAGER.
`

test('spec: stories, scenarios and id lists', () => {
  const blocks = parseSpec(SPEC)
  const stories = blocks.find((b) => b.kind === 'stories')!
  expect(stories.items[0]).toMatchObject({ title: 'Configure pager', priority: 'P1', why: 'Core value.', test: 'Set config and run.' })
  expect(stories.items[0].scenarios).toEqual([{ given: 'a config', when: 'output is long', then: 'less opens' }])
  expect(stories.items[0].rest).toContain('A scenario in free text')
  expect(stories.items[0].rest).toContain('Users set a pager.')
  const fr = blocks.find((b) => b.kind === 'idList')!
  expect(fr.items.map((i) => i.id)).toEqual(['FR-001', 'FR-006'])
  expect(fr.rest).toContain('a line with no id')
})

test('spec: nothing is dropped and order is kept', () => {
  const blocks = parseSpec(SPEC)
  const all = JSON.stringify(blocks)
  for (const s of ['What if less is missing?', 'Old configs keep PAGER.', 'NEEDS CLARIFICATION: which default?'])
    expect(all).toContain(s)
  expect(blocks.map((b) => b.kind)).toEqual(['stories', 'raw', 'idList', 'raw'])
})

test('spec: a file that matches nothing is all raw', () => {
  const blocks = parseSpec('# Notes\n\n## Anything\n\nfree text\n')
  expect(blocks).toEqual([{ kind: 'raw', heading: 'Anything', depth: 2, markdown: 'free text' }])
})
```

- [ ] **Step 2: 실패를 확인한다** — Run: `npm test -- test/parsers.test.ts`, Expected: FAIL.
- [ ] **Step 3: `parseSpec`와 `rawBlock`을 구현한다**
- [ ] **Step 4: 통과를 확인한다** — Expected: 3 passed.
- [ ] **Step 5: 커밋한다** (`feat: parse spec.md`)

---

### Task 3: tasks.md와 checklist 파서

**Files:**
- Modify: `server/parsers.ts`
- Test: `test/parsers.test.ts`

**Interfaces:**
- Produces: `export function parseTasks(src: string): Block[]`, `export function parseChecklist(src: string): Block[]`

규칙:
- 둘 다 `##` 단위로 나눈다. 체크박스가 하나라도 있는 `##` 구역은 `phase`가 된다. 없는 구역은 `raw`다.
- `phase.title`은 `##` 제목 그대로다(`Phase 3: User Story 1 - Title (Priority: P1) 🎯 MVP`). 화면이 그대로 보여준다.
- `phase.fields`는 `takeLabels`로 읽은 라벨 전부다(`Purpose`, `Goal`, `Independent Test`, `Checkpoint` 등). 라벨 이름을 고정하지 않는다.
- `phase.items`는 구역 안의 모든 체크박스다(`###` 아래 포함).
- `phase.rest`는 라벨도 체크박스 목록도 아닌 노드의 마크다운이다(`###` 제목 포함).

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
const TASKS = `# Tasks: Pager

## Format: \`[ID] [P?] [Story] Description\`

- **[P]**: Can run in parallel

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization

- [x] T001 Add which crate
- [ ] T003 [P] Create config

## Phase 3: User Story 1 - Configure (Priority: P1) 🎯 MVP

**Goal**: Deliver config

### Tests for User Story 1

- [ ] T010 [P] [US1] Contract test

**Checkpoint**: Story 1 works
`

test('tasks: phases, fields, items; sections with no checkbox stay raw', () => {
  const blocks = parseTasks(TASKS)
  expect(blocks.map((b) => b.kind)).toEqual(['raw', 'phase', 'phase'])
  const [, p1, p3] = blocks as any[]
  expect(p1.title).toBe('Phase 1: Setup (Shared Infrastructure)')
  expect(p1.fields).toEqual([{ label: 'Purpose', value: 'Project initialization' }])
  expect(p1.items.map((i: any) => [i.id, i.done, i.parallel])).toEqual([['T001', true, false], ['T003', false, true]])
  expect(p3.items[0]).toMatchObject({ id: 'T010', story: 'US1', parallel: true })
  expect(p3.fields.map((f: any) => f.label)).toEqual(['Goal', 'Checkpoint'])
  expect(p3.rest).toContain('Tests for User Story 1')
})

test('checklist: items without an ID count', () => {
  const blocks = parseChecklist('# Checklist\n\n## Content Quality\n\n- [x] No implementation details\n- [ ] CHK002 Focused on value\n\n## Notes\n\n- plain\n')
  expect(blocks.map((b) => b.kind)).toEqual(['phase', 'raw'])
  expect((blocks[0] as any).items).toHaveLength(2)
  expect((blocks[0] as any).items[0]).toMatchObject({ id: null, done: true })
})
```

- [ ] **Step 2: 실패를 확인한다** — Expected: FAIL, `parseTasks`가 없다.
- [ ] **Step 3: 두 함수를 구현한다.** 공통 함수 하나(`parseChecks`)를 두고 두 이름으로 내보낸다.
- [ ] **Step 4: 통과를 확인한다** — Expected: 전부 통과.
- [ ] **Step 5: 커밋한다** (`feat: parse tasks.md and checklists`)

---

### Task 4: 나머지 파서와 parseDoc

**Files:**
- Modify: `server/parsers.ts`
- Test: `test/parsers.test.ts`

**Interfaces:**
- Produces:

```ts
export function parsePlan(src: string): Block[]
export function parseConstitution(src: string): Block[]
export function parseResearch(src: string): Block[]
export function parseDataModel(src: string): Block[]
export function parseDoc(ref: DocRef, src: string): ParsedDoc
```

규칙:
- **plan**: `## Technical Context` 구역은 `fields`가 된다(`takeLabels`). 나머지 구역은 모두 `raw`다.
- **constitution**: `## Core Principles` 구역은 `cards`가 된다(`###` 하나가 카드 하나, 제목은 `###` 제목, 본문은 그 아래 마크다운). 나머지 구역은 `raw`다. 문서 끝의 `**Version** | **Ratified** | **Last Amended**` 줄은 `fields` 블록(`heading: 'Governance'`의 `rest`에 본문)으로 읽는다.
- **research**: `###` 구역 중 `takeLabels`가 `Decision` 라벨을 찾은 것은 `decisions` 항목이 된다. `fields`에는 찾은 라벨 전부가 순서대로 들어간다. 연속된 항목은 `decisions` 블록 하나로 묶는다. 그 밖은 `raw`다.
- **data-model**: `## Entities`(대소문자 무시, `Entities`로 시작) 구역은 `cards`가 된다(`###` 하나가 카드 하나). 그런 구역이 없으면 전부 `raw`다.
- **parseDoc**: 먼저 `clean(src)`을 한다. `title`은 첫 `#` 제목의 글자다. `meta`는 첫 `##` 앞 부분에서 `takeLabels`로 읽은 라벨이다. 그 앞 부분에 라벨이 아닌 내용이 남으면 `raw`(`heading: null`) 블록으로 맨 앞에 둔다. `kind`별로 위 파서를 고른다. `quickstart`, `other`, `.md`인 `contract`는 `##` 구역마다 `raw`다. `.md`가 아닌 `contract`는 `{ kind: 'code', lang: 확장자, text: 원문 }` 하나다(`clean`을 하지 않는다).
- 파서가 예외를 던지면 `parseDoc`은 문서 전체를 `raw` 하나로 돌려준다. 페이지는 비지 않는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
const ref = (kind: any, path = 'specs/001-x/f.md') => ({ path, kind, hash: 'h' })

test('plan: Technical Context becomes fields', () => {
  const b = parsePlan('## Summary\n\nShort.\n\n## Technical Context\n\n**Language/Version**: Rust 1.75\n\n**Storage**: NEEDS CLARIFICATION\n')
  expect(b[0]).toMatchObject({ kind: 'raw', heading: 'Summary' })
  expect(b[1]).toMatchObject({ kind: 'fields', heading: 'Technical Context' })
  expect((b[1] as any).items).toEqual([{ label: 'Language/Version', value: 'Rust 1.75' }, { label: 'Storage', value: 'NEEDS CLARIFICATION' }])
})

test('constitution: principles become cards', () => {
  const b = parseConstitution('## Core Principles\n\n### I. Library-First\n\nEvery feature starts as a library.\n\n### II. CLI\n\nText in, text out.\n\n## Governance\n\nRules.\n\n**Version**: 2.1.1 | **Ratified**: 2025-06-13 | **Last Amended**: 2025-07-16\n')
  expect((b[0] as any).items.map((i: any) => i.title)).toEqual(['I. Library-First', 'II. CLI'])
  const gov = b.find((x) => x.kind === 'fields') as any
  expect(gov.items[0]).toEqual({ label: 'Version', value: '2.1.1' })
  expect(gov.rest).toContain('Rules.')
})

test('research: decision cards; a topic with no Decision stays raw', () => {
  const b = parseResearch('## Research Topics\n\n### 1. PATH Lookup\n\n**Question**: How?\n\n**Decision**: Use which.\n\n**Rationale**:\n\n- small\n\n**Alternatives Considered**:\n\n- manual\n\n### 2. Notes\n\nfree text\n')
  const d = b.find((x) => x.kind === 'decisions') as any
  expect(d.items[0].title).toBe('1. PATH Lookup')
  expect(d.items[0].fields.map((f: any) => f.label)).toEqual(['Question', 'Decision', 'Rationale', 'Alternatives Considered'])
  expect(JSON.stringify(b)).toContain('free text')
})

test('data-model: entities become cards', () => {
  const b = parseDataModel('## Overview\n\nx\n\n## Entities\n\n### 1. PagerConfig\n\n| Field | Type |\n|---|---|\n| name | string |\n\n### 2. PagerProfile\n\ny\n')
  const c = b.find((x) => x.kind === 'cards') as any
  expect(c.items.map((i: any) => i.title)).toEqual(['1. PagerConfig', '2. PagerProfile'])
  expect(c.items[0].markdown).toContain('| name | string |')
})

test('parseDoc: title, meta, comments hidden, raw HTML kept as text', () => {
  const d = parseDoc(ref('plan'), '# Implementation Plan: Pager\n\n**Branch**: `010-pager` | **Date**: 2025-01-15\n\n## Summary\n\n<!-- ACTION REQUIRED -->\n\n<img src=x onerror=alert(1)>\n')
  expect(d.title).toBe('Implementation Plan: Pager')
  expect(d.meta.map((m) => m.label)).toEqual(['Branch', 'Date'])
  expect(JSON.stringify(d)).not.toContain('ACTION REQUIRED')
  expect(JSON.stringify(d)).toContain('onerror')
})

test('parseDoc: empty file, title only, CRLF, non-md contract', () => {
  expect(parseDoc(ref('spec'), '')).toMatchObject({ title: null, meta: [], blocks: [] })
  expect(parseDoc(ref('spec'), '# Only a title\n').blocks).toEqual([])
  expect(parseDoc(ref('tasks'), '## Phase 1: Setup\r\n\r\n- [x] T001 a\r\n').blocks[0]).toMatchObject({ kind: 'phase' })
  expect(parseDoc(ref('contract', 'specs/001-x/contracts/api.yaml'), 'openapi: 3.0.0\n').blocks)
    .toEqual([{ kind: 'code', lang: 'yaml', text: 'openapi: 3.0.0\n' }])
})

test('parseDoc: quickstart and other are raw sections', () => {
  const d = parseDoc(ref('other'), '# Analysis\n\nintro\n\n## Findings\n\nbody\n')
  expect(d.blocks).toEqual([
    { kind: 'raw', heading: null, depth: 0, markdown: 'intro' },
    { kind: 'raw', heading: 'Findings', depth: 2, markdown: 'body' },
  ])
})
```

- [ ] **Step 2: 실패를 확인한다** — Expected: FAIL.
- [ ] **Step 3: 다섯 함수를 구현한다**
- [ ] **Step 4: 통과를 확인한다** — Run: `npm test -- test/parsers.test.ts`, Expected: 전부 통과.
- [ ] **Step 5: 커밋한다** (`feat: parse plan, constitution, research, data-model`)

---

### Task 5: 프로젝트 스캔

**Files:**
- Create: `server/scan.ts`
- Test: `test/scan.test.ts`

**Interfaces:**
- Consumes: `clean`, `parse`, `checkItems` (`md.ts`), `takeLabels`
- Produces:

```ts
export function isSpecKit(root: string): boolean                       // specs/ 또는 .specify/ 가 있다
export function kindOf(relInFeature: string): DocKind
export function stageOf(f: { tasks: { done: number; total: number } | null; hasPlan: boolean }): Stage
export function scanProject(root: string, branch?: string | null): Project
export function currentBranch(root: string): string | null             // git rev-parse --abbrev-ref HEAD, 실패하면 null
```

규칙:
- `kindOf`: `spec.md`→spec, `plan.md`→plan, `tasks.md`→tasks, `research.md`→research, `data-model.md`→data-model, `quickstart.md`→quickstart, `checklists/*.md`→checklist, `contracts/**`→contract, 그 밖의 `.md`→other. `.md`가 아니고 `contracts/` 밖에 있는 파일은 문서가 아니다(목록에 넣지 않는다).
- 기능은 `specs/` 바로 아래의 디렉터리다. 앞 숫자 오름차순, 숫자가 없으면 이름순으로 뒤에 둔다. `currentFeature`와 같은 기능은 맨 앞으로 옮긴다.
- 기능 안의 문서 순서: spec, plan, research, data-model, quickstart, contract, tasks, checklist, other. 같은 종류 안에서는 경로순.
- 심볼릭 링크는 따라가지 않는다(`fs.readdirSync(..., { withFileTypes: true })`에서 `isSymbolicLink()`면 건너뛴다).
- `hash`는 파일 내용 SHA-1의 hex 앞 12자다.
- 파일을 읽지 못하면 `DocRef.error`에 메시지를 넣고 `hash`는 `''`로 둔다. 나머지 스캔은 계속한다.
- `tasks`는 `tasks.md`가 있을 때 `checkItems` 전체의 `{ done, total }`이다. 없으면 `null`이다.
- `openQuestions`는 `clean`한 `spec.md`와 `plan.md`에서 `/NEEDS CLARIFICATION/g`가 맞는 횟수의 합이다.
- `stageOf`: 설계 문서의 다섯 규칙. `total > 0 && done === total`→done, `done > 0`→implement, `tasks`가 있으면→tasks, `hasPlan`→plan, 그 밖→specify.
- `constitution`은 `.specify/memory/constitution.md`다. `constitutionVersion`은 그 파일에서 `takeLabels`로 읽은 `Version` 값이다.
- `name`은 `path.basename(root)`다.
- `scanProject`의 `branch` 인자를 생략하면 `currentBranch(root)`를 쓴다. `currentFeature`는 `branch`와 이름이 같은 기능의 id이고 없으면 `null`이다.
- `currentBranch`는 `execFileSync('git', ['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] })`를 쓴다. 셸을 거치지 않는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 테스트는 `fs.mkdtempSync(path.join(os.tmpdir(), 'specviz-'))`로 임시 프로젝트를 만든다. 도우미 `write(root, rel, text)`를 테스트 파일 안에 둔다.

```ts
test('stageOf follows the five rules', () => {
  expect(stageOf({ tasks: null, hasPlan: false })).toBe('specify')
  expect(stageOf({ tasks: null, hasPlan: true })).toBe('plan')
  expect(stageOf({ tasks: { done: 0, total: 3 }, hasPlan: false })).toBe('tasks')
  expect(stageOf({ tasks: { done: 1, total: 3 }, hasPlan: true })).toBe('implement')
  expect(stageOf({ tasks: { done: 3, total: 3 }, hasPlan: true })).toBe('done')
  expect(stageOf({ tasks: { done: 0, total: 0 }, hasPlan: true })).toBe('tasks')
})

test('kindOf', () => {
  expect(kindOf('spec.md')).toBe('spec')
  expect(kindOf('checklists/requirements.md')).toBe('checklist')
  expect(kindOf('contracts/api.yaml')).toBe('contract')
  expect(kindOf('analysis.md')).toBe('other')
})

test('scanProject: features, counts, current feature first', () => {
  const root = tmp()
  write(root, '.specify/memory/constitution.md', '# C\n\n**Version**: 1.2.0 | **Ratified**: 2025-01-01\n')
  write(root, 'specs/001-search/spec.md', '# S\n\n- **FR-001**: x [NEEDS CLARIFICATION: y]\n<!-- or NEEDS CLARIFICATION -->\n')
  write(root, 'specs/001-search/plan.md', '**Storage**: NEEDS CLARIFICATION\n')
  write(root, 'specs/002-pager/spec.md', '# P\n')
  write(root, 'specs/002-pager/tasks.md', '## Phase 1\n\n- [x] T001 a\n- [ ] T002 b\n')
  write(root, 'specs/002-pager/analysis.md', '# A\n')
  write(root, 'specs/002-pager/notes.txt', 'ignored')
  write(root, 'specs/README.md', 'not a feature')
  const p = scanProject(root, '002-pager')
  expect(p.constitutionVersion).toBe('1.2.0')
  expect(p.currentFeature).toBe('002-pager')
  expect(p.features.map((f) => f.id)).toEqual(['002-pager', '001-search'])
  expect(p.features[0]).toMatchObject({ stage: 'implement', tasks: { done: 1, total: 2 }, openQuestions: 0 })
  expect(p.features[0].docs.map((d) => d.kind)).toEqual(['spec', 'tasks', 'other'])
  expect(p.features[1]).toMatchObject({ stage: 'plan', tasks: null, openQuestions: 2 })
  expect(p.features[1].docs[0].hash).toMatch(/^[0-9a-f]{12}$/)
})

test('scanProject: no match for the branch, empty specs, symlink out of the project', () => {
  const root = tmp()
  fs.mkdirSync(path.join(root, 'specs/003-x'), { recursive: true })
  const outside = tmp(); write(outside, 'secret.md', 'secret')
  fs.symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'specs/003-x/link.md'))
  fs.symlinkSync(outside, path.join(root, 'specs/004-linked'))
  const p = scanProject(root, 'main')
  expect(p.currentFeature).toBeNull()
  expect(p.constitution).toBeNull()
  expect(p.features).toEqual([{ id: '003-x', stage: 'specify', docs: [], tasks: null, openQuestions: 0 }])
})

test('isSpecKit', () => {
  const root = tmp()
  expect(isSpecKit(root)).toBe(false)
  fs.mkdirSync(path.join(root, '.specify'))
  expect(isSpecKit(root)).toBe(true)
})
```

- [ ] **Step 2: 실패를 확인한다** — Run: `npm test -- test/scan.test.ts`, Expected: FAIL.
- [ ] **Step 3: `server/scan.ts`를 구현한다**
- [ ] **Step 4: 통과를 확인한다** — Expected: 5 passed.
- [ ] **Step 5: 커밋한다** (`feat: scan a spec-kit project`)

---

### Task 6: 서버와 CLI

**Files:**
- Create: `server/server.ts`, `server/cli.ts`
- Test: `test/server.test.ts`

**Interfaces:**
- Consumes: `scanProject`, `isSpecKit` (`scan.ts`), `parseDoc` (`parsers.ts`)
- Produces:

```ts
export function startServer(opts: { root: string; port: number; webDir: string }): Promise<{ port: number; close(): Promise<void> }>
```

라우트:
- `GET /api/project` → `Project` JSON. 요청마다 다시 스캔한다(캐시 없음).
- `GET /api/doc?path=<rel>` → `ParsedDoc` JSON. `path`가 방금 스캔한 `DocRef.path` 집합에 없으면 404와 `{ "error": "not found" }`.
- `GET /api/events` → SSE. 연결 직후 `: ok\n\n`을 보낸다. 파일이 바뀌면 `event: changed\ndata: {}\n\n`을 보낸다.
- 그 밖의 GET → `webDir`의 정적 파일. 없는 경로는 `index.html`. `webDir` 밖으로 나가는 경로는 404.
- GET이 아닌 메서드 → 405.
- `Host` 헤더가 `127.0.0.1:<port>`도 `localhost:<port>`도 아니면 403.
- 모든 응답에 `Cache-Control: no-store`.

감시: `specs`와 `.specify` 중 있는 폴더에 `fs.watch(dir, { recursive: true })`를 건다. 이벤트는 100ms 디바운스한다. 둘 다 없다가 나중에 생기는 경우는 다루지 않는다(`isSpecKit`이 시작을 막는다).

`startServer`는 `port: 0`을 받으면 빈 포트를 쓴다(테스트용). `listen` 오류는 reject한다.

CLI (`server/cli.ts`, 첫 줄 `#!/usr/bin/env node`):
- 사용법: `spec-visualizer [path] [--port N]`. `path` 기본값은 `process.cwd()`. 인자 분석은 `node:util`의 `parseArgs`를 쓴다.
- spec-kit 프로젝트가 아니면 stderr에 `Not a spec-kit project: no specs/ or .specify/ folder in <절대경로>`를 쓰고 exit 1.
- `dist/web/index.html`이 없으면 stderr에 `Web files are missing. Run: npm run build`를 쓰고 exit 1.
- `EADDRINUSE`면 stderr에 `Port <N> is in use. Try: spec-visualizer --port <N+1>`을 쓰고 exit 1.
- 성공하면 stdout에 두 줄: `spec-kit project: <n> features, <m> documents`, `Dashboard: http://127.0.0.1:<port>`.

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 임시 프로젝트와 임시 `webDir`(`index.html` 하나)을 만들고 `startServer({ root, port: 0, webDir })`로 띄운다. 요청은 `fetch`를 쓴다.

```ts
test('project and doc routes', async () => {
  const p = await (await fetch(`${base}/api/project`)).json()
  expect(p.features[0].id).toBe('001-x')
  const d = await (await fetch(`${base}/api/doc?path=specs/001-x/spec.md`)).json()
  expect(d.ref.kind).toBe('spec')
})

test('unknown and escaping paths get 404', async () => {
  for (const p of ['../../etc/passwd', 'package.json', 'specs/001-x/../../secret.md', '/etc/passwd'])
    expect((await fetch(`${base}/api/doc?path=${encodeURIComponent(p)}`)).status).toBe(404)
  expect((await fetch(`${base}/%2e%2e/%2e%2e/etc/passwd`)).status).not.toBe(200)
})

test('a foreign Host header gets 403 and POST gets 405', async () => {
  const res = await rawGet(port, '/api/project', { Host: 'evil.example' })   // node:http 로 직접 요청
  expect(res.statusCode).toBe(403)
  expect((await fetch(`${base}/api/project`, { method: 'POST' })).status).toBe(405)
})

test('a file change sends one changed event', async () => {
  const events = collectSse(`${base}/api/events`)       // 'changed' 이벤트 수를 센다
  await events.ready
  fs.appendFileSync(path.join(root, 'specs/001-x/spec.md'), '\nmore\n')
  fs.appendFileSync(path.join(root, 'specs/001-x/spec.md'), '\nmore\n')
  await wait(400)
  expect(events.count).toBe(1)
  events.close()
})

test('the listen error for a used port rejects', async () => {
  await expect(startServer({ root, port, webDir })).rejects.toMatchObject({ code: 'EADDRINUSE' })
})
```

- [ ] **Step 2: 실패를 확인한다** — Run: `npm test -- test/server.test.ts`, Expected: FAIL.
- [ ] **Step 3: `server/server.ts`를 구현한다.** `node:http`만 쓴다. 프레임워크를 넣지 않는다.
- [ ] **Step 4: 통과를 확인한다** — Expected: 5 passed.
- [ ] **Step 5: `server/cli.ts`를 구현하고 손으로 확인한다**

Run: `mkdir -p dist/web && echo ok > dist/web/index.html && node server/cli.ts /tmp`
Expected: `Not a spec-kit project: no specs/ or .specify/ folder in /tmp`, 종료 코드 1.

- [ ] **Step 6: 커밋한다** (`feat: local read-only server and CLI`)

---

### Task 7: 화면 뼈대와 홈 화면

**Files:**
- Create: `web/index.html`, `web/main.tsx`, `web/live.ts`, `web/i18n.ts`, `web/seen.ts`, `web/Home.tsx`, `web/styles.css`
- Test: `test/seen.test.ts`

**Interfaces:**
- Consumes: `server/types.ts`의 타입(`import type`만), `/api/project`, `/api/events`
- Produces:

```ts
// web/seen.ts — 저장소를 인자로 받아 테스트할 수 있게 한다
export type Seen = Record<string, string>                                  // 문서 경로 → 마지막으로 열었을 때의 해시
export function loadSeen(project: Project, store?: Storage): Seen          // 처음이면 모든 문서를 본 것으로 기록한다
export function markOf(doc: DocRef, seen: Seen): 'new' | 'changed' | null
export function markSeen(root: string, doc: DocRef, store?: Storage): Seen

// web/live.ts
export function useProject(): { project: Project | null; connected: boolean; version: number }
// version은 changed 이벤트마다 1씩 오른다. DocPage가 이것으로 다시 가져온다.

// web/i18n.ts
export type Lang = 'en' | 'ko'
export function useLang(): { lang: Lang; setLang(l: Lang): void; t(key: LabelKey): string }
```

규칙:
- 라우팅은 `location.hash`만 쓴다. `#/`는 홈, `#/doc/<encodeURIComponent(path)>`는 문서 페이지다. 라우터 라이브러리를 넣지 않는다.
- `useProject`는 시작할 때와 `changed` 이벤트마다 `/api/project`를 가져온다. `EventSource`의 `error`에서 `connected`를 `false`로, `open`에서 `true`로 한다(재연결은 `EventSource`가 스스로 한다). 다시 연결되면 모델을 한 번 더 가져온다.
- 연결이 끊기면 화면 위에 `t('disconnected')` 띠를 보인다.
- `loadSeen`: 키 `specviz:seen:<root>`. 저장된 값이 없으면 현재 모든 문서(constitution 포함)의 `{ path: hash }`를 저장하고 돌려준다. 저장소 오류가 나면 저장 없이 같은 값을 돌려준다.
- `markOf`: 기록이 없으면 `'new'`, 해시가 다르면 `'changed'`, 같으면 `null`. `doc.error`가 있으면 `null`.
- 언어: 저장된 `specviz:lang`이 있으면 그것, 없으면 `navigator.language`가 `ko`로 시작할 때 `ko`, 아니면 `en`. 전환 버튼은 화면 오른쪽 위에 둔다. `<html lang>`도 함께 바꾼다.
- 라벨 표는 `web/i18n.ts`의 객체 하나다: `const LABELS = { en: {...}, ko: {...} } satisfies Record<Lang, Record<LabelKey, string>>`. 키가 한쪽에만 있으면 타입 오류가 난다. 단계 이름(Specify, Plan, Tasks, Implement, Done)과 문서 종류 이름(spec, plan 등)은 spec-kit의 용어라 두 언어 모두 영어 그대로 둔다.

홈 화면 (`Home.tsx`)의 내용:
- 프로젝트 이름, constitution 유무와 버전(있으면 constitution 문서로 가는 링크)
- 집계 네 개: 기능 수, 문서 수(종류별 수는 title 속성 또는 작은 글자로), 전체 태스크 `done/total`, 미해결 질문 수
- 기능 목록. 기능마다: id, 현재 기능 표시, 다섯 단계 표시(지난 단계/현재 단계/남은 단계가 색만이 아니라 글자 굵기나 모양으로도 구분된다), 문서 칩(있는 문서는 링크, spec·plan·tasks 중 없는 것은 점선 칩), 칩의 새 문서/갱신 표시, 태스크 진행 막대와 `done/total`, 미해결 질문 수
- `DocRef.error`가 있는 문서 칩은 오류 모양으로 보이고 누르면 오류 메시지를 보여준다.
- 기능이 하나도 없으면 `t('noFeatures')`를 보인다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`test/seen.test.ts`). `Storage` 대신 `Map`으로 만든 가짜를 넘긴다.

```ts
const project = { root: '/p', constitution: doc('c.md', 'h0'), features: [{ docs: [doc('a.md', 'h1'), doc('b.md', 'h2')] }] } as any

test('first open records every document as seen', () => {
  const store = fakeStore()
  const seen = loadSeen(project, store)
  expect(seen).toEqual({ 'c.md': 'h0', 'a.md': 'h1', 'b.md': 'h2' })
  expect(JSON.parse(store.getItem('specviz:seen:/p')!)).toEqual(seen)
  expect(markOf(doc('a.md', 'h1'), seen)).toBeNull()
})

test('later documents are new, different hashes are changed, opening clears the mark', () => {
  const store = fakeStore(); loadSeen(project, store)
  let seen = loadSeen(project, store)
  expect(markOf(doc('new.md', 'h9'), seen)).toBe('new')
  expect(markOf(doc('a.md', 'CHANGED'), seen)).toBe('changed')
  seen = markSeen('/p', doc('a.md', 'CHANGED'), store)
  expect(markOf(doc('a.md', 'CHANGED'), seen)).toBeNull()
})

test('a storage that throws does not break the page', () => {
  const broken = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } } as any
  expect(loadSeen(project, broken)).toEqual({ 'c.md': 'h0', 'a.md': 'h1', 'b.md': 'h2' })
  expect(() => markSeen('/p', doc('a.md', 'h1'), broken)).not.toThrow()
})
```

- [ ] **Step 2: 실패를 확인한다** — Run: `npm test -- test/seen.test.ts`, Expected: FAIL.
- [ ] **Step 3: `web/seen.ts`를 구현하고 통과를 확인한다** — Expected: 3 passed.
- [ ] **Step 4: `index.html`, `main.tsx`, `live.ts`, `i18n.ts`, `Home.tsx`를 구현한다.** 이 단계의 `styles.css`는 배치만 잡는다. 모양은 Task 9에서 정한다.
- [ ] **Step 5: 손으로 확인한다.** `test/fixtures/demo/` 아래에 기능 세 개짜리 샘플 프로젝트를 직접 써서 둔다(단계가 서로 다르게: specify, plan, implement. 미해결 질문 하나, 모르는 이름의 파일 하나, 템플릿에서 벗어난 구역 하나, 템플릿 주석이 남은 plan.md 하나 포함).

Run: `npm run build && node server/cli.ts test/fixtures/demo`
Expected: 출력된 주소에서 홈 화면이 뜬다. 기능 세 개의 단계가 맞다. 언어 전환이 라벨을 바꾼다. `tasks.md`의 체크박스 하나를 고치면 새로고침 없이 진행률이 바뀌고 tasks 칩에 갱신 표시가 붙는다.

- [ ] **Step 6: 커밋한다** (`feat: home screen with live updates`)

---

### Task 8: 문서 페이지

**Files:**
- Create: `web/DocPage.tsx`, `web/Markdown.tsx`
- Modify: `web/main.tsx`, `web/styles.css`, `web/i18n.ts`

**Interfaces:**
- Consumes: `/api/doc?path=`, `useProject().version`, `markSeen`, `Block`·`ParsedDoc` 타입
- Produces: `export function DocPage(props: { path: string }): JSX.Element`, `export function Markdown(props: { children: string }): JSX.Element`

규칙:
- `Markdown`은 `react-markdown`에 `remark-gfm`만 붙인다. `rehype-raw`를 붙이지 않는다. 링크는 `target="_blank" rel="noreferrer"`로 연다.
- `DocPage`는 `path`나 `version`이 바뀌면 문서를 다시 가져온다. 다시 가져오는 동안 이전 내용을 그대로 두고, 새 내용이 오면 제자리에서 바꾼다(로딩 화면으로 갈아끼우지 않으므로 스크롤 위치가 유지된다). 문서를 처음 열 때와 새 해시가 올 때 `markSeen`을 부른다.
- 응답이 404면 `t('docGone')`과 홈 링크를 보인다. 프로젝트 모델에서 그 문서의 `error`가 있으면 오류 메시지를 보인다.
- 페이지 위쪽: 기능 id, 문서 종류, `title`, `meta`(라벨/값 줄), 홈 링크.
- 블록 종류마다 컴포넌트 하나:

| 블록 | 화면 |
|---|---|
| `stories` | 스토리마다 카드. 우선순위 배지, 제목, `why`와 `test`는 라벨 붙은 줄, 시나리오는 Given / When / Then 세 줄 묶음, `rest`는 `Markdown`. 카드는 우선순위 순서(P1, P2, …, 없음)로 정렬한다. |
| `idList` | 제목과 `id` / 본문 두 열 목록. 본문은 `Markdown`. `rest`는 `Markdown`. |
| `phase` | 제목, 진행 막대와 `done/total`, `fields`는 라벨 붙은 줄, 항목마다 체크 모양·id·본문·`[P]` 배지·스토리 배지. `rest`는 `Markdown`. |
| `fields` | 제목과 라벨/값 표. 값은 `Markdown`. `rest`는 `Markdown`. |
| `cards` | 제목과 카드 격자. 카드 본문은 `Markdown`. |
| `decisions` | 주제마다 카드. `Decision` 라벨의 값을 가장 크게, 나머지 `fields`는 라벨 붙은 구역, `rest`는 `Markdown`. |
| `raw` | 제목(있으면)과 `Markdown`. |
| `code` | `<pre><code>`. 가로로 넘치면 그 안에서 스크롤한다. |

- 값에 `NEEDS CLARIFICATION`이 들어 있는 `idList` 항목과 `fields` 항목은 강조 모양으로 보인다.
- tasks 문서 페이지는 맨 위에 전체 `done/total`을 보이고, 스토리 배지를 누르면 그 스토리의 항목만 남기는 필터를 둔다(스토리가 하나라도 있을 때만).
- `rest`가 `''`이면 아무것도 그리지 않는다.

- [ ] **Step 1: `Markdown.tsx`와 `DocPage.tsx`를 구현한다**
- [ ] **Step 2: 타입 검사를 한다**

Run: `npx tsc --noEmit`
Expected: 오류 없음.

- [ ] **Step 3: 손으로 확인한다**

Run: `npm run build && node server/cli.ts test/fixtures/demo`
Expected (각각 확인한다):
1. 샘플의 문서 종류 아홉 가지와 모르는 이름의 파일이 모두 열린다.
2. 템플릿에서 벗어난 구역이 제자리에 마크다운으로 보인다.
3. plan.md의 템플릿 주석이 보이지 않는다.
4. 샘플에 넣은 `<img src=x onerror=alert(1)>`이 글자로 보이고 실행되지 않는다.
5. 긴 spec 페이지를 아래로 내린 채 파일을 고치면 내용이 바뀌고 스크롤 위치가 유지된다.
6. 문서를 연 채로 그 파일을 지우면 `t('docGone')`과 홈 링크가 보인다.
7. 문서를 열고 홈으로 돌아가면 그 문서의 표시가 사라져 있다.

- [ ] **Step 4: 커밋한다** (`feat: typed document pages`)

---

### Task 9: 디자인과 마무리

**Files:**
- Modify: `web/styles.css`, `web/Home.tsx`, `web/DocPage.tsx`, `web/index.html`
- Create: `README.md`

- [ ] **Step 1: `hallmark` 스킬을 불러 디자인 방향을 잡고 적용한다.** 스킬에 주는 조건: 대상은 spec-kit을 쓰는 개발자, 화면은 홈과 문서 페이지 두 가지, 기존 컴포넌트 구조와 데이터는 그대로, 일반 마크다운 뷰어처럼 보이지 않을 것, 밝은 테마와 어두운 테마 모두(`prefers-color-scheme`), 폭 400px에서도 가로 스크롤이 없을 것, 키보드 포커스가 보일 것, `prefers-reduced-motion`을 지킬 것, 외부 글꼴이나 CDN을 쓰지 않을 것(오프라인에서 떠야 한다).
- [ ] **Step 2: `unslop` 스킬로 한 번 다듬는다.**
- [ ] **Step 3: 전체 테스트와 타입 검사를 한다**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 전부 통과.

- [ ] **Step 4: 공개된 실제 spec-kit 프로젝트 하나로 확인한다.** 스크래치 폴더에 얕게 복제해서 띄운다. 파일을 이 저장소로 복사하지 않는다.

Run: `git clone --depth 1 https://github.com/pamburus/hl <scratch>/hl && node server/cli.ts <scratch>/hl`
Expected: 홈 화면이 뜨고, 기능마다 단계가 파일 상태와 맞고, `010-pager`의 spec·tasks·research·data-model 페이지가 카드로 보인다. 카드가 되지 못하고 마크다운으로 떨어진 구역을 적어 둔다(고칠지는 사용자와 정한다).

- [ ] **Step 5: `README.md`를 쓴다.** 내용: 무엇인지 두 줄, 요구 사항(Node 24 이상), 실행 방법(`npm install && npm run build && node server/cli.ts <path>`), `--port`, 읽기 전용이라는 점, 지원하는 문서 종류 표, 하지 않는 것.
- [ ] **Step 6: 커밋한다** (`feat: visual design and README`)

---

## 이 계획이 설계와 다르게 정한 것

- spec.md의 `Edge Cases`, `Key Entities`, `Assumptions`와 plan.md의 `Summary`, `Constitution Check`, `Project Structure`, `Complexity Tracking`은 전용 블록 없이 다듬은 마크다운으로 보여준다. 이 구역들은 목록이나 코드 블록이라 마크다운 렌더링으로 충분하다. 전용 화면이 필요하면 블록 종류를 추가한다.
- `/api/doc`은 경로를 검사하는 대신 스캔한 경로 목록에 있는 것만 준다. 경로 탈출이 구조적으로 불가능하다.
- `Host` 헤더 검사를 추가했다. 로컬 서버를 다른 웹사이트가 DNS 재바인딩으로 읽는 것을 막는다.
