import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode
} from 'react'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'

export function SessionPanelLayout(props: {
  preference: SessionLayoutPreference
  changed: (preference: SessionLayoutPreference) => void
  control: ReactNode
  groups: ReactNode
  details: ReactNode
  scenario: ReactNode
}) {
  const p = props.preference
  return (
    <div className="session-workspace">
      <div
        className="session-column session-control-column"
        style={{ width: p.controlPaneWidth }}
      >
        <div className="session-control-pane">{props.control}</div>
        <div className="session-pane">{props.groups}</div>
      </div>
      <SessionDivider
        edge="left"
        value={p.controlPaneWidth}
        changed={(controlPaneWidth) =>
          props.changed({ ...p, controlPaneWidth })
        }
        label="Breite der Steuerungsspalte"
      />
      <div className="session-column session-center-column">
        {props.details}
      </div>
      <SessionDivider
        edge="right"
        value={p.scenarioPaneWidth}
        changed={(scenarioPaneWidth) =>
          props.changed({ ...p, scenarioPaneWidth })
        }
        label="Breite der Szenariospalte"
      />
      <div
        className="session-column session-scenario-column"
        style={{ width: p.scenarioPaneWidth }}
      >
        {props.scenario}
      </div>
    </div>
  )
}

function SessionDivider(props: {
  edge: 'left' | 'right'
  value: number
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
      const limits = props.edge === 'left' ? [240, 440] : [220, 420]
      props.changed(Math.round(Math.max(limits[0]!, Math.min(limits[1]!, raw))))
    }
    update(event.clientX)
    const move = (next: PointerEvent) => update(next.clientX)
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
  }
  const keyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const direction =
      event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (!direction) return
    event.preventDefault()
    const signedDirection = props.edge === 'left' ? direction : -direction
    const limits = props.edge === 'left' ? [240, 440] : [220, 420]
    props.changed(
      Math.max(
        limits[0]!,
        Math.min(limits[1]!, props.value + signedDirection * 10)
      )
    )
  }
  return (
    <div
      className="session-divider session-divider-vertical"
      role="separator"
      aria-label={props.label}
      aria-orientation="vertical"
      aria-valuemin={props.edge === 'left' ? 240 : 220}
      aria-valuemax={props.edge === 'left' ? 440 : 420}
      aria-valuenow={props.value}
      tabIndex={0}
      onPointerDown={resize}
      onKeyDown={keyboard}
    />
  )
}
