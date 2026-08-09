import type { EncounterTuningOverride } from '../../../shared/contracts/encounter-tuning.js'
import type { EncounterSelectionEvaluation } from '../../../shared/contracts/scene.js'
import { message } from '../../i18n/session-runtime.de.js'
import {
  formatInteger,
  formatMultiplier
} from '../../i18n/domain-formatters.de.js'

export function DifficultySummary(props: {
  evaluation: Pick<
    EncounterSelectionEvaluation,
    | 'difficultyLabel'
    | 'adjustedXp'
    | 'baseXp'
    | 'partyThresholds'
    | 'creatureCount'
    | 'message'
    | 'multiplier'
    | 'difficultyBand'
  >
  meter?: boolean
}) {
  const evaluation = props.evaluation
  const meterMaximum = Math.max(1, evaluation.partyThresholds[3] * 1.25)
  const meterPosition = Math.min(
    100,
    Math.round((evaluation.adjustedXp / meterMaximum) * 100)
  )
  return (
    <div
      className="difficulty-summary"
      data-band={evaluation.difficultyBand}
      aria-live="polite"
    >
      {props.meter && (
        <>
          <div className="difficulty-meter" aria-hidden="true">
            <span style={{ width: `${meterPosition}%` }} />
            {evaluation.partyThresholds.map((threshold, index) => (
              <i
                key={threshold + index}
                style={{
                  left: `${Math.min(100, (threshold / meterMaximum) * 100)}%`
                }}
              />
            ))}
          </div>
          <div className="difficulty-bands" aria-hidden="true">
            <span>{message('ui.easy')}</span>
            <span>{message('ui.medium')}</span>
            <span>{message('ui.hard')}</span>
            <span>{message('ui.deadly')}</span>
          </div>
        </>
      )}
      <dl>
        <div>
          <dt>{message('ui.wesen')}</dt>
          <dd>{evaluation.creatureCount}</dd>
        </div>
        <div>
          <dt>{message('encounter.baseXp')}</dt>
          <dd>{formatInteger(evaluation.baseXp)}</dd>
        </div>
        <div>
          <dt>{message('encounter.multiplier')}</dt>
          <dd>× {formatMultiplier(evaluation.multiplier)}</dd>
        </div>
        <div className="adjusted-xp">
          <dt>{message('encounter.adjusted')}</dt>
          <dd>{formatInteger(evaluation.adjustedXp)}</dd>
        </div>
        <div>
          <dt>
            {message('encounter.threshold')} {evaluation.difficultyLabel}
          </dt>
          <dd>{formatInteger(thresholdForBand(evaluation))}</dd>
        </div>
      </dl>
      <small className="difficulty-message">{evaluation.message}</small>
    </div>
  )
}

function thresholdForBand(
  evaluation: Pick<
    EncounterSelectionEvaluation,
    'difficultyBand' | 'partyThresholds'
  >
): number {
  switch (evaluation.difficultyBand) {
    case 'easy':
      return evaluation.partyThresholds[0]
    case 'medium':
      return evaluation.partyThresholds[1]
    case 'hard':
      return evaluation.partyThresholds[2]
    case 'deadly':
      return evaluation.partyThresholds[3]
    default:
      return 0
  }
}

export function TuningControls(props: {
  tuning: EncounterTuningOverride
  changed: (tuning: EncounterTuningOverride) => void
}) {
  const select = <K extends keyof EncounterTuningOverride>(
    field: K,
    values: readonly EncounterTuningOverride[K][]
  ) => (
    <select
      aria-label={field}
      value={props.tuning[field]}
      onChange={(event) =>
        props.changed({
          ...props.tuning,
          [field]: event.target.value as EncounterTuningOverride[K]
        })
      }
    >
      {values.map((value) => (
        <option key={value} value={value}>
          {tuningLabel(value)}
        </option>
      ))}
    </select>
  )
  return (
    <div className="tuning-controls">
      <label>
        {message('ui.schwierigkeit')}
        {select('difficulty', [
          'preset',
          'trivial',
          'easy',
          'medium',
          'hard',
          'deadly'
        ])}
      </label>
      <label>
        {message('ui.menge')}
        {select('amount', ['preset', 'few', 'standard', 'many'])}
      </label>
      <label>
        {message('ui.balance')}
        {select('balance', ['preset', 'even', 'varied'])}
      </label>
      <label>
        {message('ui.vielfalt')}
        {select('diversity', ['preset', 'low', 'high'])}
      </label>
    </div>
  )
}

function tuningLabel(value: string): string {
  return (
    {
      preset: message('encounter.tuning.preset'),
      trivial: message('encounter.tuning.trivial'),
      easy: message('encounter.tuning.easy'),
      medium: message('encounter.tuning.medium'),
      hard: message('encounter.tuning.hard'),
      deadly: message('encounter.tuning.deadly'),
      few: message('encounter.tuning.few'),
      standard: message('encounter.tuning.standard'),
      many: message('encounter.tuning.many'),
      even: message('encounter.tuning.even'),
      varied: message('encounter.tuning.varied'),
      low: message('encounter.tuning.low'),
      high: message('encounter.tuning.high')
    }[value] ?? value
  )
}
