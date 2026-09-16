import { Modal, Tabs, Typography } from 'antd'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import legalDocsSource from '../../../docs/terminos-condiciones-politica-privacidad.md?raw'

const { Title } = Typography

const PART_A = '# PARTE A'
const PART_B = '# PARTE B'

const aIndex = legalDocsSource.indexOf(PART_A)
const bIndex = legalDocsSource.indexOf(PART_B)
const TERMS_SOURCE = legalDocsSource.slice(aIndex, bIndex)
const PRIVACY_SOURCE = legalDocsSource.slice(bIndex)

const markdownComponents: Components = {
  h1: ({ children }) => (
    <Title level={4} className="mt-2 mb-3 !text-slate-800">
      {children}
    </Title>
  ),
  h2: ({ children }) => (
    <Title level={5} className="mt-4 mb-2 !text-slate-700">
      {children}
    </Title>
  ),
  p: ({ children }) => (
    <Typography.Paragraph className="mb-2 !text-[13px] !leading-relaxed !text-slate-600">
      {children}
    </Typography.Paragraph>
  ),
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="text-[13px] leading-relaxed text-slate-600">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 rounded-lg border-l-4 border-slate-200 bg-slate-50 px-4 py-3 text-[12px] leading-relaxed text-slate-500">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-slate-200" />,
  strong: ({ children }) => <strong className="font-semibold !text-slate-700">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 no-underline hover:underline">
      {children}
    </a>
  ),
}

export interface LegalDocsModalProps {
  open: boolean
  initialSection: 'terms' | 'privacy'
  onClose: () => void
}

export function LegalDocsModal({ open, initialSection, onClose }: LegalDocsModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnClose
      title="Documentos legales"
      className="legal-docs-modal"
    >
      <Tabs
        defaultActiveKey={initialSection}
        items={[
          {
            key: 'terms',
            label: 'Terminos y Condiciones',
            children: (
              <div className="max-h-[60vh] overflow-y-auto pr-2">
                <ReactMarkdown components={markdownComponents}>{TERMS_SOURCE}</ReactMarkdown>
              </div>
            ),
          },
          {
            key: 'privacy',
            label: 'Politica de Privacidad',
            children: (
              <div className="max-h-[60vh] overflow-y-auto pr-2">
                <ReactMarkdown components={markdownComponents}>{PRIVACY_SOURCE}</ReactMarkdown>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  )
}

export default LegalDocsModal