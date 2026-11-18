import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const safe = (h?: string) => !!h && /^(https?:|#)/i.test(h)

const components: Components = {
  // Unsafe or relative links (react-markdown blanks javascript: etc.) show as text with their target.
  a: ({ href, children }) => safe(href)
    ? <a href={href} target="_blank" rel="noreferrer">{children}</a>
    : <span>{children}{href ? ` (${href})` : ''}</span>,
  // Never load images: show alt text and the URL instead.
  img: ({ src, alt }) => <span>{alt}{src ? ` [${src}]` : ''}</span>,
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
