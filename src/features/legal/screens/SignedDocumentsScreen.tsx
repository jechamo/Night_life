import { Download, FileCheck2, Mail } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '@/platform'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { LegalDocumentSheet } from '../components/LegalDocumentSheet'
import {
  useDownloadSignedPdf,
  useEmailSignedDocuments,
  useLegalDocuments,
  useSignedDocuments,
} from '../hooks/use-legal-documents'
import type { LegalDocument } from '../model/legal'

/** "Documentos firmados" (PRD 5.1, 6.1): what I signed, which version and when. */
export function SignedDocumentsScreen() {
  const { t, i18n } = useTranslation()
  const { files } = usePlatform()
  const { data: signed = [] } = useSignedDocuments()
  const { data: documents = [] } = useLegalDocuments(signed.map((s) => s.slug))
  const [open, setOpen] = useState<LegalDocument | null>(null)
  const pdf = useDownloadSignedPdf()
  const email = useEmailSignedDocuments()

  return (
    <>
      <ScreenHeader
        title={t('signedDocs.title')}
        description={t('signedDocs.body')}
        backTo="/profile/privacy"
      />
      <div className="px-safe mt-4 space-y-3">
        {signed.length === 0 ? (
          <EmptyState
            icon={FileCheck2}
            title={t('signedDocs.emptyTitle')}
            description={t('signedDocs.emptyBody')}
          />
        ) : (
          <>
            <GlassCard className="divide-y divide-border p-0">
              {signed.map((item) => {
                const doc = documents.find((d) => d.slug === item.slug)
                return (
                  <div key={item.slug} className="flex items-center gap-3 px-4 py-3">
                    <FileCheck2 className="size-5 shrink-0 text-success" aria-hidden />
                    <div className="flex-1">
                      <p className="font-medium">{doc?.title ?? item.slug}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('signedDocs.signedOn', {
                          version: item.version,
                          date: new Date(item.signedAt).toLocaleString(i18n.language),
                        })}
                      </p>
                      {doc && doc.version !== item.version && (
                        <p className="text-sm text-warning">{t('signedDocs.outdated')}</p>
                      )}
                    </div>
                    {doc && (
                      <Button variant="ghost" size="sm" onClick={() => setOpen(doc)}>
                        {t('common.read')}
                      </Button>
                    )}
                  </div>
                )
              })}
            </GlassCard>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="outline" block disabled={pdf.isPending} onClick={() => pdf.mutate()}>
                <Download aria-hidden />
                {t('signedDocs.downloadPdf')}
              </Button>
              <Button
                variant="outline"
                block
                disabled={email.isPending}
                onClick={() => email.mutate()}
              >
                <Mail aria-hidden />
                {t('signedDocs.email')}
              </Button>
            </div>
            {pdf.data && !pdf.data.ok && (
              <p role="alert" className="text-sm text-danger">
                {t('signedDocs.pdfFailed')}
              </p>
            )}
            {email.data && (
              <p
                role={email.data.ok ? 'status' : 'alert'}
                className={email.data.ok ? 'text-sm text-success' : 'text-sm text-warning'}
              >
                {email.data.ok
                  ? t('signedDocs.emailSent')
                  : t(`signedDocs.emailErrors.${email.data.error}`)}
              </p>
            )}
            <Button
              variant="ghost"
              size="sm"
              block
              onClick={() =>
                void files.downloadJson('nightlife-connect-firmas.json', {
                  signed,
                  exportedAt: new Date().toISOString(),
                })
              }
            >
              {t('signedDocs.download')}
            </Button>
          </>
        )}
      </div>
      <LegalDocumentSheet document={open} onClose={() => setOpen(null)} />
    </>
  )
}
