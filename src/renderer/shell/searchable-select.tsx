import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'
import { AnchoredPopup } from './anchored-popup.js'
import './searchable-select.css'

export interface SearchableSelectOption {
  id: string
  label: string
  searchText?: string
  description?: string
}

interface SearchableSelectCommonProps {
  label: string
  options: readonly SearchableSelectOption[]
  emptyText: string
  searchPlaceholder: string
  noResultsText: string
  disabled?: boolean
  className?: string
  popupMinWidth?: number
  searchOptions?:
    ((query: string) => Promise<readonly SearchableSelectOption[]>) | undefined
}

interface SearchableSingleSelectProps extends SearchableSelectCommonProps {
  mode: 'single'
  value: string | null
  changed: (value: string | null) => void
}

interface SearchableMultiSelectProps extends SearchableSelectCommonProps {
  mode: 'multiple'
  values: readonly string[]
  selectedText: (count: number) => string
  changed: (values: string[]) => void
}

export type SearchableSelectProps =
  SearchableSingleSelectProps | SearchableMultiSelectProps

export function SearchableSelect(props: SearchableSelectProps) {
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputElement, setInputElement] = useState<HTMLInputElement | null>(
    null
  )
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [remoteOptions, setRemoteOptions] = useState<
    readonly SearchableSelectOption[] | null
  >(null)
  const [loading, setLoading] = useState(false)
  const searchRequest = useRef(0)
  const setInputRef = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node
    setInputElement(node)
  }, [])
  const selectedIds =
    props.mode === 'multiple' ? props.values : props.value ? [props.value] : []
  const selected = new Set(selectedIds)
  const normalizedQuery = normalizeSearchText(query)
  useEffect(() => {
    if (!open || !props.searchOptions) return
    const token = ++searchRequest.current
    const timer = window.setTimeout(() => {
      setLoading(true)
      void props.searchOptions!(query.trim())
        .then((options) => {
          if (searchRequest.current === token) setRemoteOptions(options)
        })
        .catch(() => {
          if (searchRequest.current === token) setRemoteOptions([])
        })
        .finally(() => {
          if (searchRequest.current === token) setLoading(false)
        })
    }, 180)
    return () => window.clearTimeout(timer)
  }, [open, props.searchOptions, query])
  const knownOptions = useMemo(() => {
    const known = new Map(props.options.map((option) => [option.id, option]))
    for (const option of remoteOptions ?? []) known.set(option.id, option)
    return [...known.values()]
  }, [props.options, remoteOptions])
  const matches = useMemo(() => {
    const candidates = props.searchOptions
      ? (remoteOptions ?? props.options)
      : props.options
    return candidates.filter((option) =>
      normalizeSearchText(
        `${option.label} ${option.searchText ?? ''}`
      ).includes(normalizedQuery)
    )
  }, [normalizedQuery, props.options, props.searchOptions, remoteOptions])
  const selectedOption =
    props.mode === 'single'
      ? knownOptions.find((option) => option.id === props.value)
      : undefined
  const closedText =
    props.mode === 'multiple' && props.values.length > 0
      ? props.selectedText(props.values.length)
      : props.mode === 'single' && selectedOption
        ? selectedOption.label
        : props.emptyText
  const displayedValue = open ? query : closedText
  const effectiveActiveIndex =
    matches.length === 0 ? -1 : Math.min(activeIndex, matches.length - 1)

  const openPopup = useCallback(() => {
    if (props.disabled) return
    setQuery('')
    setRemoteOptions(null)
    setActiveIndex(-1)
    setOpen(true)
  }, [props.disabled])

  const closePopup = useCallback(() => {
    setOpen(false)
    setQuery('')
    setRemoteOptions(null)
    setActiveIndex(-1)
  }, [])

  function selectOption(option: SearchableSelectOption) {
    if (props.mode === 'single') {
      props.changed(option.id)
      closePopup()
      return
    }
    props.changed(
      selected.has(option.id)
        ? props.values.filter((value) => value !== option.id)
        : [...props.values, option.id]
    )
    setQuery('')
    setActiveIndex(0)
    inputRef.current?.focus()
  }

  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (
      !open &&
      event.key.length === 1 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault()
      openPopup()
      setQuery(event.key)
      setActiveIndex(0)
      return
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      closePopup()
      return
    }
    if (event.key === 'Tab') {
      if (open) closePopup()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openPopup()
        return
      }
      if (matches.length === 0) return
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) =>
        current < 0
          ? delta > 0
            ? 0
            : matches.length - 1
          : (current + delta + matches.length) % matches.length
      )
      return
    }
    if (event.key === 'Home' && open && matches.length > 0) {
      event.preventDefault()
      setActiveIndex(0)
      return
    }
    if (event.key === 'End' && open && matches.length > 0) {
      event.preventDefault()
      setActiveIndex(matches.length - 1)
      return
    }
    if (event.key === 'Enter' && open && matches[effectiveActiveIndex]) {
      event.preventDefault()
      selectOption(matches[effectiveActiveIndex])
    }
  }

  const activeOptionId =
    open && effectiveActiveIndex >= 0
      ? `${listboxId}-option-${String(effectiveActiveIndex)}`
      : undefined
  return (
    <div
      className={`searchable-select${props.className ? ` ${props.className}` : ''}`}
    >
      <span className="searchable-select-label">{props.label}</span>
      <span className="searchable-select-control">
        <input
          ref={setInputRef}
          role="combobox"
          aria-label={props.label}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          disabled={props.disabled}
          value={displayedValue}
          placeholder={open ? props.searchPlaceholder : props.emptyText}
          onFocus={() => {
            if (!open) openPopup()
          }}
          onClick={() => {
            if (!open) openPopup()
          }}
          onChange={(event) => {
            if (!open) setOpen(true)
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={keyboard}
        />
        <span aria-hidden="true" className="searchable-select-chevron">
          ▾
        </span>
      </span>
      <AnchoredPopup
        open={open}
        anchor={inputElement}
        onDismiss={closePopup}
        className="searchable-select-popup"
        minWidth={props.popupMinWidth ?? 0}
        matchAnchorWidth
      >
        <div
          id={listboxId}
          role="listbox"
          aria-label={props.label}
          aria-multiselectable={props.mode === 'multiple' ? true : undefined}
          className="searchable-select-options"
          aria-busy={loading || undefined}
        >
          {matches.map((option, index) => (
            <button
              id={`${listboxId}-option-${String(index)}`}
              key={option.id}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={selected.has(option.id)}
              data-active={index === effectiveActiveIndex ? 'true' : undefined}
              onPointerEnter={() => setActiveIndex(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
            >
              <span>{option.label}</span>
              {option.description && <small>{option.description}</small>}
              {selected.has(option.id) && (
                <span className="searchable-select-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
          {matches.length === 0 && !loading && (
            <p className="searchable-select-empty">{props.noResultsText}</p>
          )}
        </div>
      </AnchoredPopup>
    </div>
  )
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('de')
    .trim()
}
