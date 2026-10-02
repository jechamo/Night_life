import { PanelBottomOpen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SAMPLE_VENUE } from '@/mocks/design-kit.mock'
import { BottomSheet } from '@/shared/ui/bottom-sheet'
import { Button } from '@/shared/ui/button'
import { Chip } from '@/shared/ui/chip'
import { Section } from '@/shared/ui/section'

export function SheetDemo() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Section title={t('designKit.sections.sheet')}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PanelBottomOpen aria-hidden />
        {t('designKit.sheet.open')}
      </Button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={t('designKit.sheet.title', { name: SAMPLE_VENUE.name })}
        description={t('designKit.sheet.body')}
        closeLabel={t('common.close')}
        dragHint={t('designKit.sheet.dragHint')}
      >
        <div className="flex flex-wrap gap-2">
          <Chip accent={SAMPLE_VENUE.type} selected>
            {t(`venueTypes.${SAMPLE_VENUE.type}`)}
          </Chip>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button>{t('designKit.buttons.primary')}</Button>
          <Button variant="secondary">{t('designKit.buttons.secondary')}</Button>
        </div>
      </BottomSheet>
    </Section>
  )
}
