import type { GroupManagerController } from './use-group-manager-controller.js'
import { message } from '../../i18n/session-runtime.de.js'
import {
  formatInteger,
  formatMultiplier
} from '../../i18n/domain-formatters.de.js'
import { formatCopper } from '../../presenters/money.js'
import { lootRarityKeys } from '../../../shared/values/loot-rarity.js'

export function GroupEditorBalance({
  controller: c
}: {
  controller: GroupManagerController
}) {
  if (c.state.workspaceMode === 'loot') return <LootBalance controller={c} />
  const e = c.group.evaluation
  const available = e?.canStart
  const maximum = Math.max(1, (e?.partyThresholds[3] ?? 0) * 1.25)
  const dead = c.entries.reduce((sum, entry) => sum + entry.deadQuantity, 0)
  return (
    <section className="group-editor-balance" aria-live="polite">
      <div className="group-editor-line">
        <strong>
          {available
            ? e.difficultyLabel
            : message('group.difficulty.unavailable')}
        </strong>
        <span>
          {available ? formatInteger(e.adjustedXp) : '—'}{' '}
          {message('encounter.adjusted')} XP
        </span>
        <span>
          {c.entries.reduce((sum, entry) => sum + entry.quantity, 0)}{' '}
          {message('ui.wesen')}
          {dead ? ` · ${dead} ${message('group.dead')}` : ''}
        </span>
      </div>
      <details>
        <summary>{message('groupEditor.balance')}</summary>
        {e && !available && <p>{e.message}</p>}
        <div>
          {message('group.baseXp')}: {available ? formatInteger(e.baseXp) : '—'}{' '}
          · {message('encounter.multiplier')}:{' '}
          {available ? formatMultiplier(e.multiplier) : '—'}
        </div>
        {available && (
          <>
            <div className="group-editor-meter" aria-hidden="true">
              <span
                style={{
                  width: `${Math.min(100, (e.adjustedXp / maximum) * 100)}%`
                }}
              />
              {e.partyThresholds.map((value, index) => (
                <i
                  key={index}
                  style={{ left: `${(value / maximum) * 100}%` }}
                />
              ))}
            </div>
            <div className="group-editor-thresholds">
              {(['easy', 'medium', 'hard', 'deadly'] as const).map(
                (band, index) => (
                  <span key={band}>
                    {message(`group.difficulty.${band}`)}{' '}
                    {formatInteger(e.partyThresholds[index] ?? 0)}
                  </span>
                )
              )}
            </div>
          </>
        )}
        <div>
          {message('group.levels')}:{' '}
          {c.assigned
            .map((member) => `${member.name}: ${member.level ?? '—'}`)
            .join(' · ') || '—'}
        </div>
      </details>
    </section>
  )
}
function LootBalance({
  controller: c
}: {
  controller: GroupManagerController
}) {
  const b = c.session?.balance
  const magic = b
    ? Object.values(b.currentMagic).reduce((a, n) => a + n, 0)
    : null
  const target = b?.targetMagic
    ? Object.values(b.targetMagic).reduce((a, n) => a + n, 0)
    : null
  return (
    <section className="group-editor-balance" aria-live="polite">
      <table>
        <thead>
          <tr>
            <th>{message('groupEditor.loot')}</th>
            <th>{message('groupEditor.actual')}</th>
            <th>{message('groupEditor.target')}</th>
            <th>{message('groupEditor.difference')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>{message('groupEditor.nonmagic')}</th>
            <td>{b ? formatCopper(b.currentValueCp) : '—'}</td>
            <td>
              {b?.targetValueCp == null ? '—' : formatCopper(b.targetValueCp)}
            </td>
            <td>
              {b?.differenceCp == null ? '—' : formatCopper(b.differenceCp)}
            </td>
          </tr>
          <tr>
            <th>{message('groupEditor.magic')}</th>
            <td>{magic ?? '—'}</td>
            <td>{target ?? '—'}</td>
            <td>{magic === null || target === null ? '—' : magic - target}</td>
          </tr>
        </tbody>
      </table>
      {(!b || b.status !== 'ready') && (
        <small role="status">
          {c.session?.balanceError ||
            (b
              ? message(
                  `groupEditor.${b.status as 'missing_party' | 'missing_level' | 'empty_roster' | 'unavailable_creature'}`
                )
              : message('groupEditor.pending'))}
        </small>
      )}
      <details>
        <summary>{message('groupEditor.balance')}</summary>
        {b && (
          <>
            <div>
              {message('groupEditor.coins')}: {formatCopper(b.currentCoinsCp)} ·{' '}
              {message('groupEditor.items')}: {formatCopper(b.currentItemsCp)}
            </div>
            <table>
              <tbody>
                {lootRarityKeys.map((r) => (
                  <tr key={r}>
                    <th>{r}</th>
                    <td>{b.currentMagic[r]}</td>
                    <td>{b.targetMagic?.[r] ?? '—'}</td>
                    <td>
                      {b.targetMagic
                        ? b.currentMagic[r] - b.targetMagic[r]
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small>
              {message('groupEditor.tolerance')}:{' '}
              {Math.round(b.tolerance * 100)} % · {message('groupEditor.basis')}
              : {b.rewardXp ?? '—'} (
              {b.rewardXpBasis === 'base'
                ? message('group.baseXp')
                : message('encounter.adjusted')}
              )
            </small>
          </>
        )}
      </details>
    </section>
  )
}
