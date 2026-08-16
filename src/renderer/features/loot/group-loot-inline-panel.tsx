import type { GroupRewardGeneratedRun } from '../../../shared/contracts/session-generation.js'
import { formatInteger } from '../../i18n/domain-formatters.de.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { formatCopper } from '../../presenters/money.js'
import type { GroupDraftLootPhase } from '../session/group-manager-state.js'
import { groupLootBudget, type GroupLootDraft } from './group-loot-draft.js'
import { TreasureDraftFields } from './treasure-draft-fields.js'
import { treasureDraftInvalid } from './treasure-draft.js'
import type {
  TreasureContainerPatch,
  TreasureItemPatch
} from './treasure-draft-reducer.js'
import type { CapabilityIssue } from '../../../shared/errors/capability-issue.js'
import { treasureDraftEditorMessagesDe } from './treasure-draft-editor-messages.de.js'
import './loot-dialogs.css'

export function GroupLootInlinePanel(props: {
  groupName: string
  run: GroupRewardGeneratedRun | null
  draft: GroupLootDraft | null
  phase: GroupDraftLootPhase
  error: string
  issues: readonly CapabilityIssue[]
  canGenerate: boolean
  canUndo: boolean
  canRedo: boolean
  generate: () => void
  retry: () => void
  reroll: () => void
  commit: () => void
  patchLabel: (label: string) => void
  patchItem: (id: string, patch: TreasureItemPatch) => void
  removeItem: (id: string) => void
  patchContainer: (id: string, patch: TreasureContainerPatch) => void
  removeContainer: (id: string) => void
  undo: () => void
  redo: () => void
  beginEdit: (key: string) => void
  endEdit: () => void
}) {
  const busy = props.phase === 'generating' || props.phase === 'committing'
  const budget =
    props.run && props.draft ? groupLootBudget(props.run, props.draft) : null
  const emptyReward = props.run?.treasures.length === 0
  const invalid =
    !props.draft || (!emptyReward && treasureDraftInvalid(props.draft))
  return (
    <section className="group-loot-inline-panel" aria-live="polite">
      <header>
        <span>
          <small>{message('loot.groupGeneratorKicker')}</small>
          <strong>
            {formatMessage('loot.groupGeneratorTitle', {
              name: props.groupName.trim() || message('loot.groupDraftFallback')
            })}
          </strong>
        </span>
        {!props.run && (
          <button
            type="button"
            disabled={busy || !props.canGenerate}
            onClick={props.generate}
          >
            {props.phase === 'generating'
              ? message('loot.generatorWorking')
              : message('loot.groupGenerateDraft')}
          </button>
        )}
      </header>
      {!props.run && props.phase !== 'generating' && !props.error && (
        <p>{message('loot.groupDraftHint')}</p>
      )}
      {props.error && (
        <div className="group-loot-inline-error" role="alert">
          <span>{props.error}</span>
          <button type="button" disabled={busy} onClick={props.retry}>
            {message('loot.groupRetry')}
          </button>
        </div>
      )}
      {props.run && props.draft && budget && (
        <div className="generated-loot-results">
          <p className="generated-loot-summary">
            {formatMessage('loot.groupGeneratorBudget', {
              basis:
                props.run.input.rewardXpBasis === 'adjusted'
                  ? message('loot.rewardBasisAdjusted')
                  : message('loot.rewardBasisBase'),
              xp: formatInteger(props.run.input.rewardXp),
              base: formatInteger(props.run.input.baseXp),
              adjusted: formatInteger(props.run.input.adjustedXp)
            })}
          </p>
          <section
            className={`group-loot-budget ${budget.status}`}
            aria-label={message('loot.budget')}
          >
            <div className="group-loot-budget-summary">
              <span>
                <small>{message('loot.budgetTarget')}</small>
                <strong>{formatCopper(budget.targetValueCp)}</strong>
              </span>
              <span>
                <small>{message('loot.budgetCurrent')}</small>
                <strong>{formatCopper(budget.currentValueCp)}</strong>
              </span>
              <span>
                <small>{message('loot.budgetDifference')}</small>
                <strong>
                  {budget.differenceCp > 0
                    ? `+${formatCopper(budget.differenceCp)}`
                    : budget.differenceCp < 0
                      ? `−${formatCopper(Math.abs(budget.differenceCp))}`
                      : formatCopper(0)}
                </strong>
              </span>
              <span>
                <small>{message('loot.budgetMagic')}</small>
                <strong>
                  {budget.magicActual}/{budget.magicTarget}
                </strong>
              </span>
              <div className="group-history-actions">
                <button
                  type="button"
                  aria-label={message('loot.undo')}
                  disabled={!props.canUndo || busy}
                  onClick={props.undo}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label={message('loot.redo')}
                  disabled={!props.canRedo || busy}
                  onClick={props.redo}
                >
                  ›
                </button>
              </div>
            </div>
            <div
              className="group-loot-budget-meter"
              role="progressbar"
              aria-label={message('loot.budgetCurrent')}
              aria-valuemin={0}
              aria-valuemax={Math.max(
                1,
                budget.targetValueCp,
                budget.currentValueCp
              )}
              aria-valuenow={budget.currentValueCp}
            >
              <span style={{ width: `${budget.percentage}%` }} />
            </div>
          </section>
          <div className="group-loot-run">
            {formatMessage('loot.groupGeneratorRun', {
              run: props.run.id.slice(0, 8)
            })}
          </div>
          {emptyReward ? (
            <p>{message('loot.groupNoDeficit')}</p>
          ) : (
            <TreasureDraftFields
              draft={props.draft}
              policy="catalog"
              messages={treasureDraftEditorMessagesDe()}
              issues={props.issues}
              labelChanged={props.patchLabel}
              patchItem={props.patchItem}
              removeItem={props.removeItem}
              patchContainer={props.patchContainer}
              removeContainer={props.removeContainer}
              beginEdit={props.beginEdit}
              endEdit={props.endEdit}
              itemDefinitionReadOnly={() => true}
              itemRemovalReadOnly={() => true}
              containerDefinitionReadOnly={() => true}
              containerRemovalReadOnly={() => true}
              itemMetadata={(item) => {
                if (!item.magic) return null
                const detail = [
                  item.rarity
                    ? formatMessage('loot.magicRarity', { rarity: item.rarity })
                    : message('loot.generated'),
                  item.curseName
                    ? formatMessage('loot.curseNamed', { name: item.curseName })
                    : ''
                ]
                  .filter(Boolean)
                  .join(' · ')
                return <small>{detail}</small>
              }}
            />
          )}
          {invalid && (
            <p className="loot-validation" role="alert">
              {message('loot.draftInvalid')}
            </p>
          )}
          <footer className="group-loot-inline-actions">
            <button type="button" disabled={busy} onClick={props.reroll}>
              {message('loot.groupReroll')}
            </button>
            <button
              type="button"
              className="primary-action"
              disabled={busy || invalid}
              onClick={props.commit}
            >
              {props.phase === 'committing'
                ? message('loot.groupCommitting')
                : message('loot.groupCommit')}
            </button>
          </footer>
        </div>
      )}
    </section>
  )
}
