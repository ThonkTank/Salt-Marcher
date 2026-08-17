import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import { sessionLayoutGeometry } from '../../../shared/values/session-layout-values.js'

export type SessionLayoutMode = 'full' | 'compact' | 'stacked'

export type SessionLayoutMeasurement = Readonly<{
  workspaceWidth: number | null
  centerIntrinsicWidth: number
}>

export type SessionLayoutState = Readonly<{
  preferred: SessionLayoutPreference
  available: SessionLayoutMeasurement
  effective: Readonly<{
    controlPaneWidth: number
    scenarioPaneWidth: number
  }>
  mode: SessionLayoutMode
}>

/**
 * Product fit rule: preserve preferred widths when possible; when full-mode
 * space contracts, the scenario pane yields to its minimum before control.
 * Compact/stacked mode changes composition only and never preference.
 */
export function deriveSessionLayoutState(
  preferred: SessionLayoutPreference,
  available: SessionLayoutMeasurement
): SessionLayoutState {
  const centerWidth = Math.max(
    sessionLayoutGeometry.centerMinimumWidth,
    Math.round(available.centerIntrinsicWidth)
  )
  const fullMinimum =
    sessionLayoutGeometry.controlPane.min +
    sessionLayoutGeometry.scenarioPane.min +
    centerWidth +
    sessionLayoutGeometry.dividerWidth * 2
  const width = available.workspaceWidth
  const mode: SessionLayoutMode =
    width === null || width >= fullMinimum
      ? 'full'
      : width >= sessionLayoutGeometry.compactMinimumWidth
        ? 'compact'
        : 'stacked'
  if (width === null || mode !== 'full')
    return {
      preferred,
      available,
      effective: {
        controlPaneWidth: preferred.controlPaneWidth,
        scenarioPaneWidth: preferred.scenarioPaneWidth
      },
      mode
    }
  const availableSides = Math.floor(
    width - centerWidth - sessionLayoutGeometry.dividerWidth * 2
  )
  let controlPaneWidth = preferred.controlPaneWidth
  let scenarioPaneWidth = preferred.scenarioPaneWidth
  let excess = Math.max(
    0,
    controlPaneWidth + scenarioPaneWidth - availableSides
  )
  const scenarioYield = Math.min(
    excess,
    scenarioPaneWidth - sessionLayoutGeometry.scenarioPane.min
  )
  scenarioPaneWidth -= scenarioYield
  excess -= scenarioYield
  controlPaneWidth -= Math.min(
    excess,
    controlPaneWidth - sessionLayoutGeometry.controlPane.min
  )
  return {
    preferred,
    available,
    effective: { controlPaneWidth, scenarioPaneWidth },
    mode
  }
}

export function dividerLimits(
  edge: 'left' | 'right',
  siblingWidth: number,
  workspaceWidth: number | null,
  centerIntrinsicWidth: number
) {
  const configured =
    edge === 'left'
      ? sessionLayoutGeometry.controlPane
      : sessionLayoutGeometry.scenarioPane
  if (workspaceWidth === null) return configured
  const available = Math.floor(
    workspaceWidth -
      siblingWidth -
      Math.max(centerIntrinsicWidth, sessionLayoutGeometry.centerMinimumWidth) -
      sessionLayoutGeometry.dividerWidth * 2
  )
  return {
    min: configured.min,
    max: Math.max(configured.min, Math.min(configured.max, available))
  }
}

/** Allocated width is not intrinsic demand; only actual overflow raises it. */
export function measuredCenterIntrinsicWidth(
  center: Pick<HTMLElement, 'clientWidth' | 'scrollWidth'>
): number {
  return center.scrollWidth > center.clientWidth + 1
    ? Math.max(sessionLayoutGeometry.centerMinimumWidth, center.scrollWidth)
    : sessionLayoutGeometry.centerMinimumWidth
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.round(Math.max(minimum, Math.min(maximum, value)))
}
