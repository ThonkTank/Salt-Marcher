import type { GeneratorLootRules } from '../../../shared/contracts/generator-loot-rules.js'
import {
  lootRuleFieldMetadata,
  lootRuleGroupLabel,
  validateLootRuleDraft,
  type LootRuleDraftIssue
} from '../../../shared/generator/loot-rule-metadata.js'
import { message } from '../../i18n/generator-runtime.de.js'

type Path = readonly (string | number)[]

export function GeneratorLootRulesEditor(props: {
  value: GeneratorLootRules
  changed: (value: GeneratorLootRules) => void
}) {
  const issues = validateLootRuleDraft(props.value)
  return (
    <details className="generator-loot-rules">
      <summary>{message('g.loot.title')}</summary>
      <p>{message('g.loot.hint')}</p>
      <RuleObject
        value={props.value as unknown as Record<string, unknown>}
        path={[]}
        issues={issues}
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
  issues: readonly LootRuleDraftIssue[]
  changed: (path: Path, value: unknown) => void
}) {
  return (
    <div className="generator-loot-rule-object">
      {Object.entries(props.value).map(([key, value]) => {
        const path = [...props.path, key]
        if (isUnknownArray(value))
          return (
            <details key={key} className="generator-loot-rule-group">
              <summary>{lootRuleGroupLabel(key)}</summary>
              <div className="generator-loot-rule-array">
                {value.map((entry, index) =>
                  isObject(entry) ? (
                    <details key={index}>
                      <summary>
                        {key === 'progression'
                          ? `Stufe ${String(index + 1)}`
                          : `${lootRuleGroupLabel(key)} ${String(index + 1)}`}
                      </summary>
                      <RuleObject
                        value={entry}
                        path={[...path, index]}
                        issues={props.issues}
                        changed={props.changed}
                      />
                    </details>
                  ) : (
                    <RuleField
                      key={index}
                      path={[...path, index]}
                      value={entry}
                      issue={issueAt(props.issues, [...path, index])}
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
              <summary>{lootRuleGroupLabel(key)}</summary>
              <RuleObject
                value={value}
                path={path}
                issues={props.issues}
                changed={props.changed}
              />
            </details>
          )
        return (
          <RuleField
            key={key}
            path={path}
            value={value}
            issue={issueAt(props.issues, path)}
            changed={(next) => props.changed(path, next)}
          />
        )
      })}
    </div>
  )
}

function RuleField(props: {
  path: Path
  value: unknown
  issue?: LootRuleDraftIssue | undefined
  changed: (value: string | number | boolean) => void
}) {
  const metadata = lootRuleFieldMetadata(props.path, props.value)
  if (!metadata) return null
  const helpId = `loot-rule-help-${pathKey(props.path)}`
  const errorId = `loot-rule-error-${pathKey(props.path)}`
  const describedBy = [helpId, props.issue ? errorId : null]
    .filter(Boolean)
    .join(' ')
  if (metadata.editor === 'readonly')
    return (
      <label className="generator-loot-rule-field">
        <span>{metadata.label}</span>
        <output aria-label={metadata.label}>{String(props.value)}</output>
        <small id={helpId}>{metadata.help}</small>
      </label>
    )
  if (typeof props.value === 'boolean')
    return (
      <label className="generator-loot-rule-field checkbox">
        <input
          aria-label={metadata.label}
          type="checkbox"
          checked={props.value}
          onChange={(event) => props.changed(event.currentTarget.checked)}
        />
        <span>{metadata.label}</span>
        <small id={helpId}>{metadata.help}</small>
      </label>
    )
  const fieldValue =
    typeof props.value === 'number' || typeof props.value === 'string'
      ? props.value
      : ''
  if (metadata.editor === 'select')
    return (
      <label className="generator-loot-rule-field">
        <span>{metadata.label}</span>
        <select
          aria-label={metadata.label}
          aria-describedby={describedBy}
          value={String(props.value)}
          onChange={(event) => props.changed(event.currentTarget.value)}
        >
          {metadata.options?.map((denomination) => (
            <option key={denomination} value={denomination}>
              {denomination}
            </option>
          ))}
        </select>
        <small id={helpId}>{metadata.help}</small>
        {props.issue && (
          <span id={errorId} role="alert">
            {props.issue.message}
          </span>
        )}
      </label>
    )
  return (
    <label className="generator-loot-rule-field">
      <span>
        {metadata.label}
        {metadata.unit ? ` (${metadata.unit})` : ''}
      </span>
      <input
        aria-label={
          metadata.unit
            ? `${metadata.label} (${metadata.unit})`
            : metadata.label
        }
        aria-describedby={describedBy}
        aria-invalid={props.issue ? 'true' : undefined}
        type={metadata.editor === 'text' ? 'text' : 'number'}
        min={scale(metadata.min, metadata.editor)}
        max={scale(metadata.max, metadata.editor)}
        step={scale(metadata.step, metadata.editor)}
        value={String(
          metadata.editor === 'percentage' && typeof fieldValue === 'number'
            ? fieldValue * 100
            : fieldValue
        )}
        onChange={(event) =>
          props.changed(
            typeof props.value === 'number'
              ? metadata.editor === 'percentage'
                ? event.currentTarget.valueAsNumber / 100
                : event.currentTarget.valueAsNumber
              : event.currentTarget.value
          )
        }
      />
      <small id={helpId}>{metadata.help}</small>
      {props.issue && (
        <span id={errorId} role="alert">
          {props.issue.message}
        </span>
      )}
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

function issueAt(
  issues: readonly LootRuleDraftIssue[],
  path: Path
): LootRuleDraftIssue | undefined {
  const key = JSON.stringify(path)
  return issues.find((issue) => JSON.stringify(issue.path) === key)
}

function pathKey(path: Path): string {
  return path
    .map(String)
    .join('-')
    .replaceAll(/[^a-zA-Z0-9-]/g, '-')
}

function scale(
  value: number | undefined,
  editor: 'number' | 'percentage' | 'text' | 'select' | 'readonly'
): number | undefined {
  return value === undefined
    ? undefined
    : editor === 'percentage'
      ? value * 100
      : value
}
