import {
  preparationStageLabel,
  type PreparationStage
} from './preparation-status-model.js'

export function PreparationStatus(props: {
  stage: PreparationStage
  detail: string
}) {
  if (props.stage === 'idle' && !props.detail) return null
  return (
    <div className={`planner-progress state-${props.stage}`} role="status">
      <span>{preparationStageLabel(props.stage)}</span>
      <small>{props.detail}</small>
    </div>
  )
}
