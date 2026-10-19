import { Typography } from 'antd'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

const { Title } = Typography

const components: Components = {
  h1: ({ children }) => (
    <Title level={3} className="!mb-3 !mt-2 !text-slate-900">
      {children}
    </Title>
  ),
  h2: ({ children }) => (
    <Title level={5} className="!mb-2 !mt-5 !text-slate-800">
      {children}
    </Title>
  ),
  p: ({ children }) => (
    <p className="mb-3 mt-0 text-sm leading-relaxed text-slate-700">{children}</p>
  ),
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed text-slate-700">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  code: ({ children }) => <code className="rounded bg-slate-100 px-1 text-[13px]">{children}</code>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-brand-text">
      {children}
    </a>
  ),
}

/** Renderiza un documento legal ya con los datos del operador insertados. */
export function LegalMarkdown({ source }: { source: string }) {
  return <ReactMarkdown components={components}>{source}</ReactMarkdown>
}
