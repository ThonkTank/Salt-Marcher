import type { GroupDraftState } from './group-draft.js'
import {
  formatInteger,
  formatMultiplier
} from '../../i18n/domain-formatters.de.js'
import { message } from '../../i18n/session-runtime.de.js'

export function GroupDraftEvaluation(props: {
  evaluation: GroupDraftState['evaluation']
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}) {
  const evaluation = props.evaluation
  const maximum = Math.max(1, (evaluation?.partyThresholds[3] ?? 0) * 1.25)
  const position = Math.min(
    100,
    Math.round(((evaluation?.adjustedXp ?? 0) / maximum) * 100)
  )
  const threshold = evaluation ? thresholdForEvaluation(evaluation) : 0
  const difficultyLabel = evaluation
    ? groupDifficultyLabel(evaluation.difficultyBand)
    : '—'
  return (
    <div className="group-draft-evaluation" aria-live="polite">
      <div className="group-draft-evaluation-row">
        <strong>{difficultyLabel}</strong>
        <span>
          {formatInteger(evaluation?.adjustedXp ?? 0)} XP{' '}
          {message('encounter.adjusted').toLocaleLowerCase()}
        </span>
        <small>
          {evaluation
            ? `${message('encounter.threshold')} ${difficultyLabel} ${formatInteger(threshold)}`
            : message('group.evaluationPending')}
        </small>
        <div className="group-history-actions">
          <button
            type="button"
            aria-label={message('group.undo')}
            disabled={!props.canUndo}
            onClick={props.undo}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={message('group.redo')}
            disabled={!props.canRedo}
            onClick={props.redo}
          >
            ›
          </button>
        </div>
      </div>
      <div className="group-difficulty-meter" aria-hidden="true">
        <span style={{ width: `${position}%` }} />
      </div>
      <small>
        {formatInteger(evaluation?.baseXp ?? 0)} {message('group.baseXp')} ·{' '}
        {message('encounter.multiplier')} ×{' '}
        {formatMultiplier(evaluation?.multiplier ?? 1)} ·{' '}
        {evaluation?.creatureCount ?? 0} {message('ui.wesen')}
      </small>
    </div>
  )
}

function groupDifficultyLabel(
  band: NonNullable<GroupDraftState['evaluation']>['difficultyBand']
): string {
  if (band === 'trivial') return message('group.difficulty.trivial')
  if (band === 'easy') return message('group.difficulty.easy')
  if (band === 'medium') return message('group.difficulty.medium')
  if (band === 'hard') return message('group.difficulty.hard')
  if (band === 'deadly') return message('group.difficulty.deadly')
  return message('group.difficulty.unavailable')
}

function thresholdForEvaluation(
  evaluation: NonNullable<GroupDraftState['evaluation']>
): number {
  if (evaluation.difficultyBand === 'easy') return evaluation.partyThresholds[0]
  if (evaluation.difficultyBand === 'medium')
    return evaluation.partyThresholds[1]
  if (evaluation.difficultyBand === 'hard') return evaluation.partyThresholds[2]
  if (evaluation.difficultyBand === 'deadly')
    return evaluation.partyThresholds[3]
  return 0
}
