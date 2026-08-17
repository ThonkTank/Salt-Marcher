import type { ReactNode } from 'react'

export function CompactRegister(props: {
  label: string
  columns: readonly string[]
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={props.className}
      role="table"
      aria-label={props.label}
      aria-colcount={props.columns.length}
    >
      <div className="register-head" role="row">
        {props.columns.map((column, index) => (
          <span key={`${column}-${index}`} role="columnheader">
            {column}
          </span>
        ))}
      </div>
      {props.children}
    </div>
  )
}

export function ExpandableRegisterRow(props: {
  className: string
  expanded: boolean
  expandLabel: string
  cells: readonly ReactNode[]
  toggle: () => void
  children: ReactNode
}) {
  return (
    <>
      <div className={props.className} role="row">
        {props.cells.map((cell, index) => (
          <div key={index} role="cell">
            {cell}
          </div>
        ))}
        <div role="cell">
          <button
            type="button"
            className="group-expand"
            aria-expanded={props.expanded}
            aria-label={props.expandLabel}
            onClick={props.toggle}
          >
            <span aria-hidden="true">{props.expanded ? '⌄' : '›'}</span>
          </button>
        </div>
      </div>
      {props.expanded && (
        <div className="group-expanded" role="row">
          <div role="cell" aria-colspan={props.cells.length + 1}>
            {props.children}
          </div>
        </div>
      )}
    </>
  )
}
