import { message } from '../../i18n/session-runtime.de.js'
import { useLayoutEffect, useRef, useState } from 'react'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import type {
  PartyCharacter,
  PartyCharacterDraft
} from '../../../shared/contracts/party.js'
import {
  characterFields,
  characterFormValues,
  parseCharacterForm
} from './character-profile.js'

export function CharacterProfileForm(props: {
  member: PartyCharacter | null
  busy: boolean
  blocked: boolean
  error: string | null
  save: (draft: PartyCharacterDraft) => Promise<boolean>
  registerSave?: (save: () => Promise<boolean>) => () => void
  close: () => void
}) {
  const [values, setValues] = useState(() => characterFormValues(props.member))
  const valuesRef = useRef(values)
  const [errors, setErrors] = useState<Record<string, string>>({})
  async function submit(): Promise<boolean> {
    if (props.busy) return false
    const result = parseCharacterForm(valuesRef.current)
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.path[0] === 'name'
              ? message('character.nameError')
              : message('character.valueError')
          ])
        )
      )
      return false
    }
    setErrors({})
    return props.save(result.data)
  }
  useLayoutEffect(() => props.registerSave?.(submit))
  return (
    <form
      className="character-profile-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!maintenanceDraftCoordinator.isLocked()) void submit()
      }}
    >
      {characterFields.map(({ key, label, numeric }) => (
        <label
          key={key}
          className={key === 'languages' ? 'character-wide' : undefined}
        >
          {message(label)}
          <input
            name={key}
            aria-label={message(label)}
            type={numeric ? 'number' : 'text'}
            value={values[key]}
            required={key === 'name'}
            aria-invalid={!!errors[key]}
            aria-describedby={
              errors[key] ? `character-error-${key}` : undefined
            }
            disabled={props.busy || props.blocked}
            onChange={(event) => {
              if (props.busy || maintenanceDraftCoordinator.isLocked()) return
              valuesRef.current = {
                ...valuesRef.current,
                [key]: event.target.value
              }
              setValues(valuesRef.current)
            }}
          />
          {errors[key] && (
            <small role="alert" id={`character-error-${key}`}>
              {errors[key]}
            </small>
          )}
        </label>
      ))}
      {props.error && (
        <p className="character-wide" role="alert">
          {props.error}
        </p>
      )}
      <footer className="character-wide character-actions">
        <button
          type="button"
          disabled={props.busy || props.blocked}
          onClick={() => {
            if (!maintenanceDraftCoordinator.isLocked()) props.close()
          }}
        >
          {message('character.cancel')}
        </button>
        <button type="submit" disabled={props.busy || props.blocked}>
          {message('character.save')}
        </button>
      </footer>
    </form>
  )
}
