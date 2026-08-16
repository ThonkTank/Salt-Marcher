import { sessionLayoutGeometry } from '../../../shared/values/session-layout-values.js'

export type PaneWidths = Readonly<{
  controlPaneWidth: number
  scenarioPaneWidth: number
}>

export function fitSessionPaneWidths(
  preference: PaneWidths,
  workspaceWidth: number | null
): PaneWidths {
  const controlPaneWidth = clamp(
    preference.controlPaneWidth,
    sessionLayoutGeometry.controlPane.min,
    sessionLayoutGeometry.controlPane.max
  )
  const scenarioPaneWidth = clamp(
    preference.scenarioPaneWidth,
    sessionLayoutGeometry.scenarioPane.min,
    sessionLayoutGeometry.scenarioPane.max
  )
  if (workspaceWidth === null) return { controlPaneWidth, scenarioPaneWidth }

  const minimumSideWidth =
    sessionLayoutGeometry.controlPane.min +
    sessionLayoutGeometry.scenarioPane.min
  const availableSideWidth = Math.max(
    minimumSideWidth,
    Math.floor(
      workspaceWidth -
        sessionLayoutGeometry.centerMinimumWidth -
        sessionLayoutGeometry.dividerWidth * 2
    )
  )
  const requestedSideWidth = controlPaneWidth + scenarioPaneWidth
  if (requestedSideWidth <= availableSideWidth)
    return { controlPaneWidth, scenarioPaneWidth }

  const availableExtraWidth = availableSideWidth - minimumSideWidth
  const controlExtraWidth =
    controlPaneWidth - sessionLayoutGeometry.controlPane.min
  const scenarioExtraWidth =
    scenarioPaneWidth - sessionLayoutGeometry.scenarioPane.min
  const requestedExtraWidth = controlExtraWidth + scenarioExtraWidth
  const fittedControlExtra =
    requestedExtraWidth === 0
      ? 0
      : Math.round(
          (availableExtraWidth * controlExtraWidth) / requestedExtraWidth
        )
  return {
    controlPaneWidth:
      sessionLayoutGeometry.controlPane.min + fittedControlExtra,
    scenarioPaneWidth:
      sessionLayoutGeometry.scenarioPane.min +
      availableExtraWidth -
      fittedControlExtra
  }
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.round(Math.max(minimum, Math.min(maximum, value)))
}
