import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode
} from 'react'
import { useEffect, useRef, useState } from 'react'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import { sessionLayoutGeometry } from '../../../shared/values/session-layout-values.js'
import { clamp, fitSessionPaneWidths } from './session-panel-layout-geometry.js'

export function SessionPanelLayout(props: {
  preference: SessionLayoutPreference
  changed: (preference: SessionLayoutPreference) => void
  control: ReactNode
  groups: ReactNode
  details: ReactNode
  scenario: ReactNode
}) {
  const p = props.preference
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [workspaceWidth, setWorkspaceWidth] = useState<number | null>(null)
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return
    const update = () =>
      setWorkspaceWidth(workspace.getBoundingClientRect().width)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(workspace)
    return () => observer.disconnect()
  }, [])
  const effective = fitSessionPaneWidths(p, workspaceWidth)
  return (
    <div className="session-workspace" ref={workspaceRef}>
      <div
        className="session-column session-control-column"
        style={{ width: effective.controlPaneWidth }}
      >
        <div className="session-control-pane">{props.control}</div>
        <div className="session-pane">{props.groups}</div>
      </div>
      <SessionDivider
        edge="left"
        value={effective.controlPaneWidth}
        siblingWidth={effective.scenarioPaneWidth}
        workspaceWidth={workspaceWidth}
        changed={(controlPaneWidth) =>
          props.changed({
            ...p,
            controlPaneWidth,
            scenarioPaneWidth: effective.scenarioPaneWidth
          })
        }
        label="Breite der Steuerungsspalte"
      />
      <div className="session-column session-center-column">
        {props.details}
      </div>
      <SessionDivider
        edge="right"
        value={effective.scenarioPaneWidth}
        siblingWidth={effective.controlPaneWidth}
        workspaceWidth={workspaceWidth}
        changed={(scenarioPaneWidth) =>
          props.changed({
            ...p,
            controlPaneWidth: effective.controlPaneWidth,
            scenarioPaneWidth
          })
        }
        label="Breite der Szenariospalte"
      />
      <div
        className="session-column session-scenario-column"
        style={{ width: effective.scenarioPaneWidth }}
      >
        {props.scenario}
      </div>
    </div>
  )
}

function SessionDivider(props: {
  edge: 'left' | 'right'
  value: number
  siblingWidth: number
  workspaceWidth: number | null
  changed: (value: number) => void
  label: string
}) {
  const resize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const parent = event.currentTarget.parentElement
    if (!parent) return
    const bounds = parent.getBoundingClientRect()
    const update = (clientX: number) => {
      const raw =
        props.edge === 'left' ? clientX - bounds.left : bounds.right - clientX
      const limits = dividerLimits(props.edge, props.siblingWidth, bounds.width)
      props.changed(clamp(raw, limits.min, limits.max))
    }
    update(event.clientX)
    const move = (next: PointerEvent) => update(next.clientX)
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
    window.addEventListener('pointercancel', stop, { once: true })
  }
  const keyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const direction =
      event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (!direction) return
    event.preventDefault()
    const signedDirection = props.edge === 'left' ? direction : -direction
    const limits = dividerLimits(
      props.edge,
      props.siblingWidth,
      props.workspaceWidth
    )
    props.changed(
      clamp(props.value + signedDirection * 10, limits.min, limits.max)
    )
  }
  const limits = dividerLimits(
    props.edge,
    props.siblingWidth,
    props.workspaceWidth
  )
  return (
    <div
      className="session-divider session-divider-vertical"
      role="separator"
      aria-label={props.label}
      aria-orientation="vertical"
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      aria-valuenow={props.value}
      tabIndex={0}
      onPointerDown={resize}
      onKeyDown={keyboard}
    />
  )
}

function dividerLimits(
  edge: 'left' | 'right',
  siblingWidth: number,
  workspaceWidth: number | null
) {
  const configured =
    edge === 'left'
      ? sessionLayoutGeometry.controlPane
      : sessionLayoutGeometry.scenarioPane
  if (workspaceWidth === null) return configured
  const available = Math.floor(
    workspaceWidth -
      siblingWidth -
      sessionLayoutGeometry.centerMinimumWidth -
      sessionLayoutGeometry.dividerWidth * 2
  )
  return {
    min: configured.min,
    max: Math.max(configured.min, Math.min(configured.max, available))
  }
}
