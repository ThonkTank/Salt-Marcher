import type { GeneratorLootRules } from '../../../shared/contracts/generator-loot-rules.js'
import { message } from '../../i18n/generator-runtime.de.js'

type Path = readonly (string | number)[]

export function GeneratorLootRulesEditor(props: {
  value: GeneratorLootRules
  changed: (value: GeneratorLootRules) => void
}) {
  return (
    <details className="generator-loot-rules">
      <summary>{message('g.loot.title')}</summary>
      <p>{message('g.loot.hint')}</p>
      <RuleObject
        value={props.value as unknown as Record<string, unknown>}
        path={[]}
        changed={(path, value) =>
          props.changed(updatePath(props.value, path, value))
        }
      />
    </details>
  )
}

function RuleObject(props: {
  value: Record<string, unknown>
  path: Path
  changed: (path: Path, value: unknown) => void
}) {
  return (
    <div className="generator-loot-rule-object">
      {Object.entries(props.value).map(([key, value]) => {
        const path = [...props.path, key]
        if (isUnknownArray(value))
          return (
            <details key={key} className="generator-loot-rule-group">
              <summary>{label(key)}</summary>
              <div className="generator-loot-rule-array">
                {value.map((entry, index) =>
                  isObject(entry) ? (
                    <details key={index}>
                      <summary>
                        {key === 'progression'
                          ? `Level ${String(index + 1)}`
                          : `${label(key)} ${String(index + 1)}`}
                      </summary>
                      <RuleObject
                        value={entry}
                        path={[...path, index]}
                        changed={props.changed}
                      />
                    </details>
                  ) : (
                    <RuleField
                      key={index}
                      name={`${label(key)} ${String(index + 1)}`}
                      value={entry}
                      changed={(next) => props.changed([...path, index], next)}
                    />
                  )
                )}
              </div>
            </details>
          )
        if (isObject(value))
          return (
            <details key={key} className="generator-loot-rule-group">
              <summary>{label(key)}</summary>
              <RuleObject value={value} path={path} changed={props.changed} />
            </details>
          )
        return (
          <RuleField
            key={key}
            name={label(key)}
            value={value}
            changed={(next) => props.changed(path, next)}
          />
        )
      })}
    </div>
  )
}

function RuleField(props: {
  name: string
  value: unknown
  changed: (value: string | number | boolean) => void
}) {
  if (typeof props.value === 'boolean')
    return (
      <label className="generator-loot-rule-field checkbox">
        <input
          type="checkbox"
          checked={props.value}
          onChange={(event) => props.changed(event.currentTarget.checked)}
        />
        <span>{props.name}</span>
      </label>
    )
  const fieldValue =
    typeof props.value === 'number' || typeof props.value === 'string'
      ? props.value
      : ''
  return (
    <label className="generator-loot-rule-field">
      <span>{props.name}</span>
      <input
        type={typeof props.value === 'number' ? 'number' : 'text'}
        step={typeof props.value === 'number' ? 'any' : undefined}
        value={String(fieldValue)}
        onChange={(event) =>
          props.changed(
            typeof props.value === 'number'
              ? event.currentTarget.valueAsNumber
              : event.currentTarget.value
          )
        }
      />
    </label>
  )
}

function updatePath<T>(root: T, path: Path, value: unknown): T {
  const copy = structuredClone(root)
  let cursor = copy as Record<string | number, unknown>
  for (const key of path.slice(0, -1))
    cursor = cursor[key] as Record<string | number, unknown>
  cursor[path.at(-1)!] = value
  return copy
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}

function label(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (first) => first.toUpperCase())
}
