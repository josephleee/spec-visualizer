import { expect, test } from 'vitest'
import { translate } from '../web/i18n.ts'

test('English picks singular or plural from the number', () => {
  expect(translate('en', 'strip.left', '010-pager', 1)).toBe('010-pager · 1 task left')
  expect(translate('en', 'strip.left', '010-pager', 15)).toBe('010-pager · 15 tasks left')
  expect(translate('en', 'g.move', 1, 'Plan')).toBe('Moves 1 feature on to Plan')
  expect(translate('en', 'g.move', 7, 'Plan')).toBe('Moves 7 features on to Plan')
  expect(translate('en', 'sp.story', 2, 1)).toBe('Story 2 · 1 scenario')
  expect(translate('en', 'sp.story', 1, 4)).toBe('Story 1 · 4 scenarios')
  expect(translate('en', 'i.groups', 1)).toBe('1 group')
  expect(translate('en', 'more.blocks', 1)).toBe('1 more source block')
  expect(translate('en', 'more.blocks', 3)).toBe('3 more source blocks')
  expect(translate('en', 'h.all', 1)).toBe('The 1 feature follows these principles')
  expect(translate('en', 'h.all', 3)).toBe('All 3 features follow these principles')
  expect(translate('en', 'i.left.n', 1)).toBe('open in 1 phase')
  expect(translate('en', 'i.left.n', 4)).toBe('open in 4 phases')
  expect(translate('en', 't.expand', 1)).toBe('Show 1 task')
  expect(translate('en', 'g.impl', 0)).toBe('Continue with the 0 tasks left')
})

test('Korean has no plural forms and is unchanged', () => {
  expect(translate('ko', 'strip.left', '010-pager', 1)).toBe('010-pager · 남은 작업 1개')
  expect(translate('ko', 'g.move', 1, '계획')).toBe('기능 1개를 계획 단계로')
})

test('no label leaks its plural syntax or an unfilled slot', () => {
  for (const lang of ['en', 'ko'] as const) for (const n of [0, 1, 2]) {
    const s = translate(lang, 'i.outside', n, n) + translate(lang, 'sp.groups', n, n) + translate(lang, 'q.steps', n) + translate(lang, 'p.files', n) + translate(lang, 'o.sub', n) + translate(lang, 'n.items', n)
    expect(s).not.toMatch(/[{}|]/)
  }
})
