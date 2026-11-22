import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

type MarkdownContentProps = {
  children: string
}

export function MarkdownContent({ children }: MarkdownContentProps) {
  return (
    <div className='markdown-content'>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        skipHtml
        components={{
          a: ({ href, children }) =>
            href ? (
              <a href={href} target='_blank' rel='noopener noreferrer'>
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
