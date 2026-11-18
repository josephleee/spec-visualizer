import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const safe = (h?: string) => !!h && /^(https?:|#)/i.test(h)

const components: Components = {
  // Unsafe or relative links (react-markdown blanks javascript: etc.) show as text with their target.
  // A title is content too: it follows the link as text.
  a: ({ href, title, children }) => safe(href)
    ? <><a href={href} target="_blank" rel="noreferrer">{children}</a>{title ? ` (${title})` : ''}</>
    : <span>{children}{href ? ` (${href}${title ? ` "${title}"` : ''})` : title ? ` (${title})` : ''}</span>,
  // Never load images: show alt text and the URL instead.
  img: ({ src, alt, title }) => <span>{alt}{src ? ` [${src}${title ? ` "${title}"` : ''}]` : title ? ` [${title}]` : ''}</span>,
  // A fenced block shows its whole info string (language and whatever follows it) above the code.
  pre: ({ node, children }) => {
    const code = node?.children.find(c => c.type === 'element' && c.tagName === 'code')
    const cls = code?.type === 'element' && Array.isArray(code.properties.className) ? code.properties.className : []
    const lang = cls.map(String).find(c => c.startsWith('language-'))?.slice(9)
    const meta = (code?.data as { meta?: string } | undefined)?.meta
    const info = [lang, meta].filter(Boolean).join(' ')
    return <>{info && <span className="lbl">{info}</span>}<pre>{children}</pre></>
  },
  // A wide table scrolls inside its own box, never the page.
  table: ({ children }) => <div className="tablewrap" tabIndex={0}><table>{children}</table></div>,
  // A task-list checkbox is read-only here: draw the tick, not a disabled control.
  input: ({ checked }) => <span className={checked ? 'tick on' : 'tick'} role="img" aria-label={checked ? '[x]' : '[ ]'} />,
}
const inlineComponents: Components = { ...components, p: ({ children }) => <>{children}</> }

// Heading text is one line of inline markdown: escape what would start a list, quote, heading, fence or rule.
const asHeading = (s: string) => s
  .replace(/^(\d+)([.)])(?=\s|$)/, '$1\\$2')
  .replace(/^([-+*](?=\s|$)|[>#]|`{3}|~{3}|([-*_])(?=(?:\s*\2){2,}\s*$))/, '\\$1')

export function Markdown({ children, inline, heading }: { children: string; inline?: boolean; heading?: boolean }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={inline || heading ? inlineComponents : components}>
      {heading ? asHeading(children) : children}
    </ReactMarkdown>
  )
}
