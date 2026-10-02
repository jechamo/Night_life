import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LANGUAGE, isLanguage } from '@/i18n'
import { usePlatform } from '@/platform'
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

function useLanguageCode() {
  const { i18n } = useTranslation()
  return isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANGUAGE
}

/** Signed PDF from the server, saved through the platform layer (PRD 6.1, 3.3). */
export function useDownloadSignedPdf() {
  const { legal } = useServices()
  const { files } = usePlatform()
  const language = useLanguageCode()
  return useMutation({
    mutationFn: async () => {
      const pdf = await legal.downloadSignedPdf(language)
      if (!pdf.ok) return pdf
      return files.downloadBlob('nightlife-connect-documentos-firmados.pdf', pdf.value)
    },
  })
}

export function useEmailSignedDocuments() {
  const { legal } = useServices()
  const language = useLanguageCode()
  return useMutation({ mutationFn: () => legal.emailSignedDocuments(language) })
}
