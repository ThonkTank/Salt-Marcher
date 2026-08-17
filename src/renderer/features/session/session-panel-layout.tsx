import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import { message } from '../../i18n/session-runtime.de.js'
import { ResizeSeparator } from '../shared/resize-separator.js'
import {
  deriveSessionLayoutState,
  dividerLimits,
  measuredCenterIntrinsicWidth,
  type SessionLayoutMeasurement
} from './session-panel-layout-geometry.js'

export function SessionPanelLayout(props: {
  preference: SessionLayoutPreference
  changed: (preference: SessionLayoutPreference) => void
  control: ReactNode
  groups: ReactNode
  details: ReactNode
  scenario: ReactNode
}) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const centerRef = useRef<HTMLDivElement>(null)
  const [measurement, setMeasurement] = useState<SessionLayoutMeasurement>({
    workspaceWidth: null,
    centerIntrinsicWidth: 360
  })
  useEffect(() => {
    const workspace = workspaceRef.current
    const center = centerRef.current
    if (!workspace || !center) return
    const update = () =>
      setMeasurement({
        workspaceWidth: workspace.getBoundingClientRect().width,
        centerIntrinsicWidth: measuredCenterIntrinsicWidth(center)
      })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(workspace)
    observer.observe(center)
    return () => observer.disconnect()
  }, [])
  const state = deriveSessionLayoutState(props.preference, measurement)
  const leftLimits = dividerLimits(
    'left',
    state.effective.scenarioPaneWidth,
    measurement.workspaceWidth,
    measurement.centerIntrinsicWidth
  )
  const rightLimits = dividerLimits(
    'right',
    state.effective.controlPaneWidth,
    measurement.workspaceWidth,
    measurement.centerIntrinsicWidth
  )
  return (
    <div
      className="session-workspace"
      data-layout-mode={state.mode}
      data-session-layout-ready={measurement.workspaceWidth !== null}
      data-workspace-width={measurement.workspaceWidth ?? undefined}
      ref={workspaceRef}
    >
      <div
        className="session-column session-control-column"
        style={
          state.mode === 'full'
            ? { width: state.effective.controlPaneWidth }
            : undefined
        }
      >
        <div className="session-control-pane">{props.control}</div>
        <div className="session-pane">{props.groups}</div>
      </div>
      {state.mode === 'full' && (
        <ResizeSeparator
          edge="left"
          value={state.effective.controlPaneWidth}
          minimum={leftLimits.min}
          maximum={leftLimits.max}
          changed={(controlPaneWidth) =>
            props.changed({ ...props.preference, controlPaneWidth })
          }
          label={message('session.layout.controlWidth')}
          className="session-divider session-divider-vertical"
        />
      )}
      <div className="session-column session-center-column" ref={centerRef}>
        {props.details}
      </div>
      {state.mode === 'full' && (
        <ResizeSeparator
          edge="right"
          value={state.effective.scenarioPaneWidth}
          minimum={rightLimits.min}
          maximum={rightLimits.max}
          changed={(scenarioPaneWidth) =>
            props.changed({ ...props.preference, scenarioPaneWidth })
          }
          label={message('session.layout.scenarioWidth')}
          className="session-divider session-divider-vertical"
        />
      )}
      <div
        className="session-column session-scenario-column"
        style={
          state.mode === 'full'
            ? { width: state.effective.scenarioPaneWidth }
            : undefined
        }
      >
        {props.scenario}
      </div>
    </div>
  )
}
