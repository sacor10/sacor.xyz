import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const components = {
  h1: ({ children }) => (
    <h1 className="md-h1">
      <font face="Impact" size="6" color="#00FFFF">
        {children}
      </font>
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="md-h2">
      <font face="Impact" size="5" color="#FF00FF">
        ~ {children} ~
      </font>
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="md-h3">
      <font face="Impact" size="4" color="#FFFF00">
        &#9733; {children} &#9733;
      </font>
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="md-h4">
      <font face="Impact" size="3" color="#00FF00">
        {children}
      </font>
    </h4>
  ),
  p: ({ children }) => (
    <p className="md-p">
      <font face="Comic Sans MS" size="3" color="#FFFFFF">
        {children}
      </font>
    </p>
  ),
  ul: ({ children }) => <ul className="md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="md-ol">{children}</ol>,
  li: ({ children }) => (
    <li className="md-li">
      <font face="Comic Sans MS" size="3" color="#FFFFFF">
        {children}
      </font>
    </li>
  ),
  strong: ({ children }) => <b className="hotpink">{children}</b>,
  em: ({ children }) => <i className="cyan">{children}</i>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="md-quote">{children}</blockquote>,
  code: ({ inline, children }) =>
    inline ? <code className="md-code-inline">{children}</code> : <code>{children}</code>,
  pre: ({ children }) => <pre className="md-pre">{children}</pre>,
  hr: () => <hr className="md-hr" />,
  table: ({ children }) => (
    <table className="md-table" cellPadding="6" cellSpacing="0" border="2">
      {children}
    </table>
  ),
  th: ({ children }) => (
    <th className="md-th">
      <font face="Impact" color="#FFFF00">
        {children}
      </font>
    </th>
  ),
  td: ({ children }) => (
    <td className="md-td">
      <font face="Comic Sans MS" size="2" color="#FFFFFF">
        {children}
      </font>
    </td>
  ),
}

export default function MarkdownView({ children }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children || ''}
      </ReactMarkdown>
    </div>
  )
}
