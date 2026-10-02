import { Inbox } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { TextField } from '@/shared/ui/text-field'
import { useAdminAct, useAdminList } from '../hooks/use-admin'
import { ADMIN_SECTIONS, type AdminRow, type AdminSection } from '../services/admin-service'

/** Actions available per section and the statuses they apply to. */
const ACTIONS: Partial<
  Record<AdminSection, { on: readonly string[]; actions: readonly AdminAction[] }>
> = {
  verifications: { on: ['pending'], actions: ['approve', 'reject'] },
  reports: { on: ['open'], actions: ['warn', 'suspend', 'dismiss'] },
  appeals: { on: ['pending'], actions: ['accept', 'reject'] },
  bans: { on: ['active'], actions: ['lift'] },
  claims: { on: ['pending'], actions: ['approve', 'reject'] },
  events: { on: ['unconfirmed', 'confirmed', 'official', 'restored'], actions: ['hide', 'delete'] },
  sponsorships: { on: ['requested', 'active'], actions: ['activate', 'end'] },
  entitlements: { on: ['active'], actions: ['revoke'] },
  dataRequests: { on: ['open'], actions: ['done'] },
  legalDocs: { on: ['inactive'], actions: ['publish'] },
}
type AdminAction =
  | 'approve'
  | 'reject'
  | 'warn'
  | 'suspend'
  | 'dismiss'
  | 'accept'
  | 'lift'
  | 'hide'
  | 'delete'
  | 'activate'
  | 'end'
  | 'revoke'
  | 'done'
  | 'publish'

/** Decisions that affect a person must be explained (DSA art. 17): the note is mandatory. */
const NEEDS_NOTE = new Set<AdminAction>(['reject', 'warn', 'suspend', 'hide', 'delete', 'revoke'])

const STATUSES = [
  'pending',
  'open',
  'active',
  'inactive',
  'approved',
  'rejected',
  'dismissed',
  'warned',
  'suspended',
  'accepted',
  'lifted',
  'ended',
  'done',
  'hidden',
  'restored',
  'deleted',
  'revoked',
  'requested',
  'logged',
  'expired',
  'cancel_at_period_end',
  'withdrawn',
  'unconfirmed',
  'confirmed',
  'official',
  'cancelled',
] as const
const isStatus = (value: string): value is (typeof STATUSES)[number] =>
  (STATUSES as readonly string[]).includes(value)

const isSection = (value: string): value is AdminSection =>
  (ADMIN_SECTIONS as readonly string[]).includes(value)

function RowCard({ section, row }: { section: AdminSection; row: AdminRow }) {
  const { t, i18n } = useTranslation()
  const statusLabel = (status: string) => (isStatus(status) ? t(`admin.status.${status}`) : status)
  const act = useAdminAct()
  const [note, setNote] = useState('')
  const config = ACTIONS[section]
  const actions = config && config.on.includes(row.status) ? config.actions : []
  return (
    <GlassCard className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold break-words">{row.title}</p>
          <p className="text-sm break-words text-muted-foreground">{row.subtitle}</p>
        </div>
        <Badge
          tone={['pending', 'open', 'requested'].includes(row.status) ? 'unconfirmed' : 'neutral'}
        >
          {statusLabel(row.status)}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{new Date(row.createdAt).toLocaleString(i18n.language)}</span>
        {row.facts.map((fact) => (
          <span key={fact} className="font-label rounded-full border border-border px-2 py-0.5">
            {fact}
          </span>
        ))}
      </div>
      {actions.length > 0 && (
        <div className="space-y-2 pt-1">
          <TextField
            label={t('admin.section.note')}
            hint={t('admin.section.noteHint')}
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action}
                size="sm"
                variant={NEEDS_NOTE.has(action) ? 'outline' : 'secondary'}
                disabled={act.isPending || (NEEDS_NOTE.has(action) && note.trim().length < 5)}
                onClick={() =>
                  act.mutate({ section, id: row.id, action, note: note.trim() || undefined })
                }
              >
                {t(`admin.actions.${action}`)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  )
}

/** Generic admin queue/list (verifications, moderation, claims, rights, audit...). */
export function AdminSectionScreen() {
  const { section = '' } = useParams()
  if (!isSection(section)) return <Navigate to="/admin" replace />
  return <SectionList key={section} section={section} />
}

function SectionList({ section }: { section: AdminSection }) {
  const { t } = useTranslation()
  const { data: rows, isPending } = useAdminList(section)
  return (
    <>
      <ScreenHeader
        title={t(`admin.sections.${section}.title`)}
        description={t(`admin.sections.${section}.body`)}
      />
      <div className="px-safe mt-4 space-y-3">
        {!isPending && rows?.length === 0 && (
          <EmptyState
            icon={Inbox}
            title={t('admin.section.emptyTitle')}
            description={t('admin.section.emptyBody')}
          />
        )}
        {rows?.map((row) => (
          <RowCard key={row.id} section={section} row={row} />
        ))}
      </div>
    </>
  )
}
