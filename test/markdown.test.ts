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

const block = (s: string) => renderToStaticMarkup(createElement(Markdown, { children: s }))

test('only http(s) and # links can be followed; every other target is shown as text', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,<b>x</b>', './other.md', '../spec.md', '/abs/path', '//evil.example/x', 'file:///etc/passwd', 'vbscript:x']) {
    const html = block(`[label](${href})`)
    expect(html, href).not.toContain('<a')
    expect(html, href).not.toContain('href')
    expect(html, href).toContain('label')
  }
  expect(block('[a](https://example.com/x)')).toContain('<a href="https://example.com/x" target="_blank" rel="noreferrer">a</a>')
  expect(block('[a](#part)')).toContain('<a href="#part"')
})

test('an image is never loaded: its alt text and address are shown as text', () => {
  const html = block('![the alt](https://example.com/pixel.png)')
  expect(html).not.toContain('<img')
  expect(html).not.toContain('src=')
  expect(html).toContain('the alt')
  expect(html).toContain('[https://example.com/pixel.png]')
})

test('raw HTML in a document is escaped, never run', () => {
  const html = block('before <script>alert(1)</script> <img src=x onerror=alert(1)> <b>bold</b>\n\n<iframe src="https://example.com"></iframe>')
  for (const tag of ['<script', '<img', '<iframe', '<b>']) expect(html).not.toContain(tag)
  expect(html).toContain('&lt;script&gt;')
  expect(html).toContain('&lt;iframe')
})

test('a link title is shown as text after the link, followable or not', () => {
  expect(block('[a](https://example.com "The Title")')).toContain('<a href="https://example.com" target="_blank" rel="noreferrer">a</a> (The Title)')
  const unsafe = block('[a](./x.md "Local Title")')
  expect(unsafe).not.toContain('<a')
  expect(unsafe).toContain('Local Title')
  expect(block('[a](https://example.com)')).not.toContain('()')
})

test('an image title is part of its text form', () => {
  const html = block('![alt](https://example.com/p.png "Pic Title")')
  expect(html).not.toContain('<img')
  expect(html).toContain('alt [https://example.com/p.png &quot;Pic Title&quot;]')
})

test('the whole info string of a fenced block is shown, not only the language', () => {
  const html = block('```rust title="src/main.rs" {1,3}\nfn main() {}\n```')
  expect(html).toContain('rust title=&quot;src/main.rs&quot; {1,3}')
  expect(html).toContain('fn main() {}')
  expect(block('```\nplain\n```')).not.toContain('class="lbl"')
  expect(block('```toml\na = 1\n```')).toContain('<span class="lbl">toml</span>')
})

test('a link that cannot be followed does not repeat a target identical to its text', () => {
  expect(block('[spec.md](spec.md)')).toBe('<p><span>spec.md</span></p>')
  expect(block('[spec.md](./spec.md)')).toBe('<p><span>spec.md (./spec.md)</span></p>')
  expect(block('[spec.md](spec.md "T")')).toContain('spec.md (T)')
})
