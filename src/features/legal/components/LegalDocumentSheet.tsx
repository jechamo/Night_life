import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/shared/ui/bottom-sheet'
import type { LegalDocument } from '../model/legal'

/**
 * Full legal document in a sheet. Content is rendered as plain text nodes
 * (never as HTML) so imported or edited texts can't inject markup (PRD 6.15 A05).
 */
export function LegalDocumentSheet({
  document,
  onClose,
}: {
  document: LegalDocument | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={document !== null}
      onOpenChange={(open) => !open && onClose()}
      title={document?.title ?? ''}
      description={
        document ? t('onboarding.legal.version', { version: document.version }) : undefined
      }
      closeLabel={t('common.close')}
      dragHint={t('designKit.sheet.dragHint')}
    >
      {document && (
        <article className="space-y-4 pb-4">
          <p className="text-muted-foreground">{document.summary}</p>
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h3 className="font-display text-lg font-semibold">{section.heading}</h3>
              <p className="mt-1 leading-relaxed">{section.body}</p>
            </section>
          ))}
          <p className="font-label text-xs text-warning">{t('onboarding.legal.lawyerNote')}</p>
        </article>
      )}
    </BottomSheet>
  )
}
