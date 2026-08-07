import { formatMessage } from '../../i18n/worldplanner-runtime.de.js'
import { TokenCombobox } from '../../shell/token-combobox.js'

export function LocationReferencePicker(props: {
  label: string
  placeholder: string
  options: readonly Readonly<{ id: string; label: string }>[]
  selected: readonly string[]
  query: string
  setQuery: (query: string) => void
  disabled: boolean
  inputDisabled?: boolean
  changed: (ids: string[]) => void
  hint?: string
  createAction?: Readonly<{ label: string; run: () => void }>
}) {
  const selectedOptions = props.selected.map(
    (id) =>
      props.options.find((option) => option.id === id) ?? { id, label: id }
  )
  const needle = props.query.trim().normalize('NFKC').toLocaleLowerCase()
  const hits = needle
    ? props.options
        .filter(
          (option) =>
            !props.selected.includes(option.id) &&
            option.label.normalize('NFKC').toLocaleLowerCase().includes(needle)
        )
        .slice(0, 5)
    : []
  return (
    <section className="location-section reference-picker">
      <h3>{props.label}</h3>
      <TokenCombobox
        inputLabel={props.placeholder}
        placeholder={props.placeholder}
        selected={selectedOptions}
        suggestions={hits}
        query={props.query}
        onQueryChange={props.setQuery}
        onSelect={(option) => {
          props.changed([...props.selected, option.id])
          props.setQuery('')
        }}
        onRemove={(option) =>
          props.changed(props.selected.filter((id) => id !== option.id))
        }
        removeLabel={(option) =>
          formatMessage('ui.verknuepfung.entfernen', { name: option.label })
        }
        disabled={props.disabled}
        inputAction={
          props.createAction ? (
            <button
              type="button"
              className="location-inline-create"
              disabled={props.disabled}
              onClick={props.createAction.run}
            >
              {props.createAction.label}
            </button>
          ) : undefined
        }
        {...(props.inputDisabled === undefined
          ? {}
          : { inputDisabled: props.inputDisabled })}
        layout="stacked"
      />
      {props.hint && <p className="reference-picker-hint">{props.hint}</p>}
    </section>
  )
}
