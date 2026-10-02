import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Skeleton } from '@/shared/ui/skeleton'
import { ConsentEditorView } from './components/ConsentEditorView'
import { useConsentEditor } from './hooks/use-consent-editor'
import { useConsents, useSaveConsents } from './hooks/use-consents'
import type { ConsentState } from './services/consent-service'

function ConsentsForm({ initial }: { initial: ConsentState }) {
  const { t } = useTranslation()
  const editor = useConsentEditor(initial)
  const save = useSaveConsents()
  return (
    <div className="px-safe mt-6 space-y-4 pb-4">
      <ConsentEditorView editor={editor} />
      <Button
        block
        size="lg"
        disabled={!editor.isValid || save.isPending}
        onClick={() =>
          save.mutate({ choices: editor.choices, city: editor.needsCity ? editor.city : null })
        }
      >
        {t('common.save')}
      </Button>
      {save.isSuccess && (
        <p role="status" className="text-center text-sm text-live">
          {t('common.saved')}
        </p>
      )}
    </div>
  )
}

/** Revoking is as easy as granting (PRD 6.1). */
export function ConsentsSettingsScreen() {
  const { t } = useTranslation()
  const { data } = useConsents()
  return (
    <>
      <ScreenHeader
        title={t('consentSettings.title')}
        description={t('consentSettings.description')}
        backTo="/profile"
      />
      {data ? <ConsentsForm initial={data} /> : <Skeleton className="m-4 h-64" />}
    </>
  )
}
