import type { FormEvent, ReactNode } from 'react'

export type CatalogCrudItem = Readonly<{ id: string; label: string }>

/** Shared catalog cockpit for selecting, creating, and renaming an aggregate. */
export function CatalogCrudControlsView(props: {
  title: string
  items: readonly CatalogCrudItem[]
  selectedId: string
  emptyLabel: string
  selectLabel: string
  createLabel: string
  createValue: string
  createButtonLabel: string
  editLabel?: string
  editValue?: string
  saveButtonLabel?: string
  onSelect: (id: string) => void
  onCreateValueChange: (value: string) => void
  onCreate: () => void | Promise<void>
  onEditValueChange?: (value: string) => void
  onSave?: () => void | Promise<void>
  children?: ReactNode
}) {
  const submitCreate = (event: FormEvent) => {
    event.preventDefault()
    void props.onCreate()
  }
  return (
    <section className="catalog-crud-controls">
      <form onSubmit={submitCreate}>
        <h2>{props.title}</h2>
        <input
          aria-label={props.createLabel}
          value={props.createValue}
          onChange={(event) => props.onCreateValueChange(event.target.value)}
        />
        <button disabled={!props.createValue.trim()}>
          {props.createButtonLabel}
        </button>
      </form>
      <label>
        {props.selectLabel}
        <select
          value={props.selectedId}
          onChange={(event) => props.onSelect(event.target.value)}
        >
          <option value="">{props.emptyLabel}</option>
          {props.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {props.selectedId &&
        props.editLabel &&
        props.editValue !== undefined &&
        props.onEditValueChange &&
        props.onSave && (
          <>
            <label>
              {props.editLabel}
              <input
                value={props.editValue}
                onChange={(event) =>
                  props.onEditValueChange?.(event.target.value)
                }
              />
            </label>
            <button onClick={() => void props.onSave?.()}>
              {props.saveButtonLabel}
            </button>
          </>
        )}
      {props.children}
    </section>
  )
}
