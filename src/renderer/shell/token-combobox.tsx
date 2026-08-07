import { useId, useState, type ReactNode } from 'react'
import './token-combobox.css'

export type TokenComboboxOption = Readonly<{
  id: string
  label: string
  meta?: string
}>

export function TokenCombobox(props: {
  inputLabel: string
  placeholder: string
  selected: readonly TokenComboboxOption[]
  suggestions: readonly TokenComboboxOption[]
  query: string
  onQueryChange: (query: string) => void
  onSelect: (option: TokenComboboxOption) => void
  onRemove: (option: TokenComboboxOption) => void
  removeLabel: (option: TokenComboboxOption) => string
  disabled: boolean
  inputDisabled?: boolean
  busy?: boolean
  selectionMode?: 'single' | 'multiple'
  layout: 'inline' | 'stacked'
  maxLength?: number
  inputAction?: ReactNode
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const suggestions = props.suggestions
  const foundActive = suggestions.findIndex((option) => option.id === activeId)
  const activeIndex = foundActive < 0 ? 0 : foundActive

  const select = (option: TokenComboboxOption) => {
    props.onSelect(option)
    setOpen(false)
  }
  const chips = props.selected.map((option) => (
    <span className="token-combobox-chip" key={option.id}>
      {option.label}
      <button
        type="button"
        disabled={props.disabled}
        aria-label={props.removeLabel(option)}
        onClick={() => props.onRemove(option)}
      >
        ×
      </button>
    </span>
  ))
  const input = (
    <input
      role="combobox"
      aria-label={props.inputLabel}
      aria-autocomplete="list"
      aria-expanded={open && suggestions.length > 0}
      aria-controls={listId}
      aria-busy={props.busy || undefined}
      aria-activedescendant={
        open && suggestions[activeIndex]
          ? `${listId}-option-${activeIndex}`
          : undefined
      }
      maxLength={props.maxLength}
      disabled={props.disabled || props.inputDisabled}
      placeholder={props.placeholder}
      value={props.query}
      onFocus={() => setOpen(suggestions.length > 0)}
      onChange={(event) => {
        setActiveId(null)
        setOpen(true)
        props.onQueryChange(event.target.value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false)
          return
        }
        if (
          event.key === 'Backspace' &&
          !props.query &&
          props.selected.at(-1)
        ) {
          props.onRemove(props.selected.at(-1)!)
          return
        }
        if (suggestions.length === 0) return
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setOpen(true)
          setActiveId(
            suggestions[
              foundActive < 0 ? 0 : (activeIndex + 1) % suggestions.length
            ]!.id
          )
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          setOpen(true)
          setActiveId(
            suggestions[
              foundActive < 0
                ? suggestions.length - 1
                : (activeIndex - 1 + suggestions.length) % suggestions.length
            ]!.id
          )
        } else if (event.key === 'Home') {
          event.preventDefault()
          setOpen(true)
          setActiveId(suggestions[0]!.id)
        } else if (event.key === 'End') {
          event.preventDefault()
          setOpen(true)
          setActiveId(suggestions.at(-1)!.id)
        } else if (event.key === 'Enter' && open) {
          event.preventDefault()
          select(suggestions[activeIndex] ?? suggestions[0]!)
        }
      }}
    />
  )

  return (
    <div
      className={`token-combobox token-combobox-${props.layout}`}
      data-selection-mode={props.selectionMode ?? 'multiple'}
    >
      {props.layout === 'inline' ? (
        <div className="token-combobox-control">
          {chips}
          {input}
        </div>
      ) : (
        <>
          {props.selected.length > 0 && (
            <div className="token-combobox-selected">{chips}</div>
          )}
          <div className="token-combobox-input-row">
            {input}
            {props.inputAction}
          </div>
        </>
      )}
      {open && suggestions.length > 0 && (
        <div
          className="token-combobox-options"
          id={listId}
          role="listbox"
          aria-label={props.inputLabel}
        >
          {suggestions.map((option, index) => (
            <button
              type="button"
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              data-active={index === activeIndex || undefined}
              key={option.id}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveId(option.id)}
              onClick={() => select(option)}
            >
              <span>{option.label}</span>
              {option.meta && <em>{option.meta}</em>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
