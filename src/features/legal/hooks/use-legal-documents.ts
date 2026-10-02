import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LANGUAGE, isLanguage } from '@/i18n'
import { useServices } from '@/shared/services/ServicesProvider'
import type { LegalDocument, LegalDocumentSlug } from '../model/legal'

export function useLegalDocuments(slugs: readonly LegalDocumentSlug[]) {
  const { legal } = useServices()
  const { i18n } = useTranslation()
  const language = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANGUAGE
  return useQuery({
    queryKey: ['legal', 'documents', language, ...slugs],
    queryFn: () => legal.getDocuments(slugs, language),
  })
}

export function useSignDocuments() {
  const { legal } = useServices()
  return useMutation({
    mutationFn: (documents: readonly Pick<LegalDocument, 'slug' | 'version'>[]) =>
      legal.sign(documents),
  })
}

export function useSignedDocuments() {
  const { legal } = useServices()
  return useQuery({ queryKey: ['legal', 'signed'], queryFn: () => legal.getSigned() })
}
