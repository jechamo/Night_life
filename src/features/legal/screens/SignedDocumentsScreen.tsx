import { Download, FileCheck2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '@/platform'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { LegalDocumentSheet } from '../components/LegalDocumentSheet'
import { useLegalDocuments, useSignedDocuments } from '../hooks/use-legal-documents'
import type { LegalDocument } from '../model/legal'

/** "Documentos firmados" (PRD 5.1, 6.1): what I signed, which version and when. */
export function SignedDocumentsScreen() {
  const { t, i18n } = useTranslation()
  const { files } = usePlatform()
  const { data: signed = [] } = useSignedDocuments()
  const { data: documents = [] } = useLegalDocuments(signed.map((s) => s.slug))
  const [open, setOpen] = useState<LegalDocument | null>(null)

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
            <Button
              variant="outline"
              block
              onClick={() =>
                void files.downloadJson('nightlife-connect-firmas.json', {
                  signed,
                  exportedAt: new Date().toISOString(),
                })
              }
            >
              <Download aria-hidden />
              {t('signedDocs.download')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('signedDocs.pdfSoon')}</p>
          </>
        )}
      </div>
      <LegalDocumentSheet document={open} onClose={() => setOpen(null)} />
    </>
  )
}
