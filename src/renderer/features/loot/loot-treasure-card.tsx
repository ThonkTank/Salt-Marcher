import { useState } from 'react'
import type { Treasure } from '../../../shared/contracts/loot.js'
import { itemDefinitionLineValueCp } from '../../../shared/values/item-definition-values.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { formatCopper } from '../../presenters/money.js'

export function LootTreasureCard(props: {
  treasure: Treasure
  edit: (treasure: Treasure) => void
  distribute: (treasure: Treasure) => void
  fallbackLabel?: string | undefined
}) {
  const [expanded, setExpanded] = useState(true)
  const remaining = props.treasure.items.reduce(
    (sum, item) => sum + item.quantity - item.allocatedQuantity,
    0
  )
  return (
    <article className="loot-treasure-card">
      <header>
        <button
          type="button"
          className="loot-treasure-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          <span>
            <strong>{props.treasure.label}</strong>
            <small>
              {formatCopper(props.treasure.totalValueCp)} ·{' '}
              {distributionLabel(props.treasure.distributionState, remaining)}
            </small>
          </span>
        </button>
        <div>
          <button type="button" onClick={() => props.edit(props.treasure)}>
            {message('loot.edit')}
          </button>
          <button
            type="button"
            disabled={remaining === 0}
            onClick={() => props.distribute(props.treasure)}
          >
            {message('loot.distribute')}
          </button>
        </div>
      </header>
      {props.fallbackLabel && (
        <p className="loot-anchor-fallback">
          {formatMessage('loot.anchorFallback', { name: props.fallbackLabel })}
        </p>
      )}
      {expanded && (
        <ul>
          {props.treasure.items.map((item) => (
            <li key={item.id}>
              <span>
                {item.quantity}× {item.definition.name}
              </span>
              <small>
                {formatMessage('loot.distributionAllocated', {
                  allocated: item.allocatedQuantity,
                  total: item.quantity
                })}{' '}
                ·{' '}
                {formatCopper(
                  itemDefinitionLineValueCp(item.definition, item.quantity)
                )}
                {item.definition.magic
                  ? ` · ${formatMessage('loot.magicRarity', {
                      rarity:
                        item.definition.rarity ?? message('loot.generated')
                    })}`
                  : ''}
                {item.definition.curse
                  ? ` · ${formatMessage('loot.curseNamed', {
                      name: item.definition.curse.name
                    })}`
                  : ''}
              </small>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function distributionLabel(
  state: Treasure['distributionState'],
  remaining: number
): string {
  if (state === 'complete') return message('loot.distributionDone')
  if (state === 'partial')
    return formatMessage('loot.distributionOpen', { count: remaining })
  return message('loot.distributionNone')
}
