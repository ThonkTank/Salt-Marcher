import { message } from '../../i18n/session-runtime.de.js'
import { useId, useState, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate
} from '@floating-ui/react'
import { OverlayLayerContext } from '../../shell/modal-layer.js'
import type { RestProgress } from './party-progress.js'
export function PartyTooltip(props: { text: string; children: ReactNode }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const layer = useContext(OverlayLayerContext)
  const { refs, floatingStyles } = useFloating({
    open,
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate
  })
  return (
    <span
      ref={(node) => {
        refs.setReference(node)
      }}
      className="party-tooltip"
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {props.children}
      {open &&
        layer?.layer &&
        createPortal(
          <span
            ref={(node) => {
              refs.setFloating(node)
            }}
            id={id}
            role="tooltip"
            className="party-tooltip-content"
            style={{ ...floatingStyles, zIndex: 1000 }}
          >
            {props.text}
          </span>,
          layer.layer
        )}
    </span>
  )
}
export function PartyMeter(props: {
  fill: number | null
  sections?: number | null
  label: string
}) {
  return (
    <span
      className="party-meter"
      role="img"
      data-unknown={props.fill === null}
      aria-label={props.label}
    >
      <span
        className="party-meter-fill"
        style={{ width: `${(props.fill ?? 0) * 100}%` }}
      />
      {props.sections != null &&
        Array.from({ length: props.sections - 1 }, (_, index) => (
          <i
            key={index}
            style={{ left: `${((index + 1) / props.sections!) * 100}%` }}
          />
        ))}
    </span>
  )
}
export function PartyRestMeter({
  value,
  partial
}: {
  value: RestProgress
  partial?: boolean
}) {
  return (
    <PartyTooltip text={value.text}>
      <span
        tabIndex={0}
        className="party-rest-meter"
        data-due={value.due}
        aria-label={value.text}
      >
        <span>
          {message('party.restLabel')}
          {partial ? '*' : ''}
        </span>
        <PartyMeter
          fill={value.fill}
          sections={value.sections}
          label={value.text}
        />
      </span>
    </PartyTooltip>
  )
}
