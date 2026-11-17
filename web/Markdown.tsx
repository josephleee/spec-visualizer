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
}
const inlineComponents: Components = { ...components, p: ({ children }) => <>{children}</> }

export function Markdown({ children, inline }: { children: string; inline?: boolean }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={inline ? inlineComponents : components}>{children}</ReactMarkdown>
}
