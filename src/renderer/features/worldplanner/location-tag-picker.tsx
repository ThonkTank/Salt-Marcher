import { useEffect, useMemo, useRef, useState } from 'react'
import { canonicalWorldLocationTag } from '../../../shared/values/world-location-values.js'
import { formatMessage, message } from '../../i18n/worldplanner-runtime.de.js'
import {
  TokenCombobox,
  type TokenComboboxOption
} from '../../shell/token-combobox.js'

export function LocationTagPicker(props: {
  suggestTags: (query: string, limit?: number) => Promise<readonly string[]>
  tags: readonly string[]
  query: string
  setQuery: (query: string) => void
  changed: (tags: string[]) => void
  disabled: boolean
}) {
  const { suggestTags } = props
  const request = useRef(0)
  const [response, setResponse] = useState<{
    requestKey: string
    options: readonly TokenComboboxOption[]
    failed: boolean
  }>({ requestKey: '', options: [], failed: false })
  const [retry, setRetry] = useState(0)
  const selectedKeys = useMemo(
    () => new Set(props.tags.map(canonicalWorldLocationTag)),
    [props.tags]
  )
  const value = props.query.trim()
  const key = canonicalWorldLocationTag(value)
  const requestKey = `${key}:${retry}`
  const known = response.requestKey === requestKey ? response.options : []
  const status = !key
    ? 'idle'
    : response.requestKey !== requestKey
      ? 'loading'
      : response.failed
        ? 'failed'
        : 'idle'
  useEffect(() => {
    const current = ++request.current
    if (!key) return undefined
    void suggestTags(value, 6)
      .then((tags) => {
        if (current !== request.current) return
        const byKey = new Map<string, string>()
        for (const tag of tags) {
          const canonical = canonicalWorldLocationTag(tag)
          if (canonical && !byKey.has(canonical))
            byKey.set(canonical, tag.trim())
        }
        setResponse({
          requestKey,
          options: [...byKey].map(([id, label]) => ({ id, label })),
          failed: false
        })
      })
      .catch(() => {
        if (current === request.current) {
          setResponse({ requestKey, options: [], failed: true })
        }
      })
    return () => {
      request.current += 1
    }
  }, [key, requestKey, suggestTags, value])
  const hits = key
    ? known
        .filter(
          (option) => !selectedKeys.has(option.id) && option.id.includes(key)
        )
        .slice(0, 5)
    : []
  const exact = known.some((option) => option.id === key)
  const suggestions: TokenComboboxOption[] = key
    ? [
        ...(!exact && value.length <= 40
          ? [
              {
                id: `new:${key}`,
                label: value,
                meta: message('ui.tag.neu')
              }
            ]
          : []),
        ...hits.map((option) => ({
          ...option,
          id: `existing:${option.id}`,
          meta: message('ui.tag.vorhanden')
        }))
      ]
    : []

  const add = (option: TokenComboboxOption) => {
    const tag = option.label.trim()
    const canonical = canonicalWorldLocationTag(tag)
    if (
      !canonical ||
      tag.length > 40 ||
      props.tags.length >= 20 ||
      selectedKeys.has(canonical)
    )
      return
    props.changed([...props.tags, tag])
    props.setQuery('')
  }

  return (
    <div className="location-tag-control">
      <span className="location-field-label">{message('ui.tags')}</span>
      <TokenCombobox
        inputLabel={message('ui.tags')}
        placeholder={message('ui.tags.platzhalter')}
        selected={props.tags.map((tag) => ({
          id: canonicalWorldLocationTag(tag),
          label: tag
        }))}
        suggestions={suggestions}
        query={props.query}
        onQueryChange={props.setQuery}
        onSelect={add}
        onRemove={(option) =>
          props.changed(
            props.tags.filter(
              (tag) => canonicalWorldLocationTag(tag) !== option.id
            )
          )
        }
        removeLabel={(option) =>
          formatMessage('ui.tag.entfernen', { tag: option.label })
        }
        disabled={props.disabled}
        inputDisabled={props.tags.length >= 20}
        busy={status === 'loading'}
        layout="inline"
        maxLength={40}
      />
      {status === 'failed' && (
        <div className="world-location-reference-error" role="alert">
          <p>{message('ui.tags.nicht.verfuegbar')}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {message('action.retry')}
          </button>
        </div>
      )}
    </div>
  )
}
