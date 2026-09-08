import { message } from '../../i18n/session-runtime.de.js'
import { useState } from 'react'
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
  error: string | null
  save: (draft: PartyCharacterDraft) => void
  close: () => void
}) {
  const [values, setValues] = useState(() => characterFormValues(props.member))
  const [errors, setErrors] = useState<Record<string, string>>({})
  return (
    <form
      className="character-profile-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (props.busy) return
        const result = parseCharacterForm(values)
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
          return
        }
        setErrors({})
        props.save(result.data)
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
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                [key]: event.target.value
              }))
            }
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
        <button type="button" disabled={props.busy} onClick={props.close}>
          {message('character.cancel')}
        </button>
        <button type="submit" disabled={props.busy}>
          {message('character.save')}
        </button>
      </footer>
    </form>
  )
}
