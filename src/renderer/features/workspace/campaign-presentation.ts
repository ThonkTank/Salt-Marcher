import type { Campaign } from '../../../shared/contracts/campaign.js'
import { formatMessage, message } from '../../i18n/campaign-menu-runtime.de.js'

export function compareCampaigns(a: Campaign, b: Campaign): number {
  return (
    (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? '') ||
    b.createdAt.localeCompare(a.createdAt) ||
    a.id.localeCompare(b.id)
  )
}

export function formatCampaignOpenedAt(
  value: string | null,
  now = new Date()
): string {
  if (!value) return message('campaign.openedUnknown')
  const date = new Date(value)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const time = new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
  const day =
    date.toDateString() === now.toDateString()
      ? message('campaign.today')
      : date.toDateString() === yesterday.toDateString()
        ? message('campaign.yesterday')
        : new Intl.DateTimeFormat('de-DE', { dateStyle: 'short' }).format(date)
  return formatMessage('campaign.openedAt', { date: `${day}, ${time}` })
}
