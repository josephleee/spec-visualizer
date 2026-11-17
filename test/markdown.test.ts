import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Markdown } from '../web/Markdown.tsx'

const heading = (s: string) => renderToStaticMarkup(createElement(Markdown, { heading: true, children: s }))

test('heading markdown renders emphasis and code inline', () => {
  expect(heading('User Scenarios & Testing *(mandatory)*')).toBe('User Scenarios &amp; Testing <em>(mandatory)</em>')
  expect(heading('Format: `[ID] [P?] [Story] Description`')).toBe('Format: <code>[ID] [P?] [Story] Description</code>')
})

test('heading text that would start a block stays text', () => {
  for (const s of ['1. PATH Lookup', '2) Second step', '- dash', '+ plus', '* star', '# hash', '> quote', '---', '```js'])
    expect(heading(s)).toBe(s.replace('>', '&gt;'))
  expect(heading('**Bold** start')).toBe('<strong>Bold</strong> start')
})
