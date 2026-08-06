import './reference-multi-select.css'

export function ReferenceMultiSelect(props: {
  label: string
  options: readonly { id: string; label: string }[]
  selected: readonly string[]
  disabled?: boolean
  changed: (values: string[]) => void
}) {
  return (
    <label className="reference-multi-select">
      <span>
        {props.label}
        {props.selected.length ? ` (${props.selected.length})` : ''}
      </span>
      <select
        multiple
        aria-label={props.label}
        disabled={props.disabled}
        value={[...props.selected]}
        onChange={(event) =>
          props.changed(
            Array.from(
              event.currentTarget.selectedOptions,
              (option) => option.value
            )
          )
        }
      >
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
