import { Navigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { FeatureGate } from '@/shared/flags/FeatureGate'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  BadgesDemo,
  ButtonsDemo,
  ChipsDemo,
  SegmentedDemo,
  SkeletonDemo,
} from './components/KitBasics'
import { LiveStatsDemo } from './components/LiveStatsDemo'
import { ServicesDemo } from './components/ServicesDemo'
import { SheetDemo } from './components/SheetDemo'

/** Component kit to review every base component in every theme (testing tool, PRD 6.14). */
export function DesignKitScreen() {
  const { t } = useTranslation()
  return (
    <FeatureGate
      flag="test_tools_enabled"
      is="on"
      fallback={<Navigate to="/profile" replace />}
      pending={<Skeleton className="m-4 h-40" />}
    >
      <ScreenHeader
        title={t('designKit.title')}
        description={t('designKit.description')}
        backTo="/profile"
      />
      <LiveStatsDemo />
      <ButtonsDemo />
      <ChipsDemo />
      <BadgesDemo />
      <SegmentedDemo />
      <SheetDemo />
      <SkeletonDemo />
      <ServicesDemo />
    </FeatureGate>
  )
}
