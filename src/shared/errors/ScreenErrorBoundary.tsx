import { TriangleAlert } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

interface Props {
  children: ReactNode
}
interface State {
  failed: boolean
}

/**
 * Error boundary per screen (PRD 3.4, 6.15 A10). Users only see a generic,
 * translated message; details are never shown nor logged with personal data.
 */
export class ScreenErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  override componentDidCatch(error: Error, _info: ErrorInfo) {
    // Only the error type: messages may contain user data (PRD 3.2 "logs limpios").
    console.error('Screen crashed:', error.name)
  }

  override render() {
    if (!this.state.failed) return this.props.children
    return <GenericErrorFallback onRetry={() => this.setState({ failed: false })} />
  }
}

export function GenericErrorFallback({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={TriangleAlert}
      title={t('errors.generic.title')}
      description={t('errors.generic.description')}
      action={onRetry && <Button onClick={onRetry}>{t('common.retry')}</Button>}
    />
  )
}
