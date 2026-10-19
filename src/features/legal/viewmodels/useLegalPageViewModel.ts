import { useNavigate, useParams } from 'react-router-dom'
import { useLegalEntity } from '@/hooks/useLegal'
import { LEGAL_SOURCES } from '../documents'
import {
  LEGAL_DOCUMENT_META,
  isLegalSlug,
  missingEntityFields,
  renderLegal,
  type LegalSlug,
} from '../legal.logic'

export function useLegalPageViewModel() {
  const params = useParams()
  const navigate = useNavigate()
  const slug: LegalSlug = isLegalSlug(params.doc) ? params.doc : 'terminos'
  const entityQuery = useLegalEntity()

  return {
    slug,
    options: (Object.keys(LEGAL_DOCUMENT_META) as LegalSlug[]).map((value) => ({
      value,
      label: LEGAL_DOCUMENT_META[value].short,
    })),
    go: (value: string) => navigate(`/legal/${value}`),
    loading: entityQuery.isLoading,
    incomplete: !entityQuery.isLoading && missingEntityFields(entityQuery.data).length > 0,
    text: renderLegal(LEGAL_SOURCES[slug], entityQuery.data),
  }
}
