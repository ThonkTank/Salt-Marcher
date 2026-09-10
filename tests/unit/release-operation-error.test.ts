import { ProfileLockedError } from '../../src/main/local-profile/local-profile-lock.js'
import { describe, expect, it } from 'vitest'
import { releaseOperationErrorText } from '../../src/main/release/operation-error.js'

describe('release operation errors', () => {
  it.each(['application', 'installer', 'unknown'] as const)(
    'explains a profile held by %s with a next action',
    (owner) => {
      const message = releaseOperationErrorText(
        new ProfileLockedError('/private/profile.lock', owner)
      )
      expect(message).toContain('Das Profil wird gerade verwendet.')
      expect(message).toContain('Schließe die andere SaltMarcher-Instanz')
      expect(message).toContain('versuche es erneut')
      expect(message).not.toContain('/private')
    }
  )
  it.each(['ENOSPC', 'EDQUOT'])(
    'explains %s without exposing filesystem paths',
    (code) => {
      const error = Object.assign(
        new Error('copyfile /private/cache -> /private/deployment'),
        { code }
      )
      expect(releaseOperationErrorText(error)).toBe(
        'Nicht genug freier Speicherplatz. Gib Speicherplatz frei und versuche den Vorgang erneut.'
      )
    }
  )
  it('preserves actionable domain failures', () => {
    const message = 'Bitte das Update zuerst herunterladen.'
    expect(releaseOperationErrorText(new Error(message))).toBe(message)
  })
  it('does not interpret domain text as an operating system error code', () => {
    expect(
      releaseOperationErrorText(new Error('ENOSPC im importierten Text'))
    ).toBe('ENOSPC im importierten Text')
  })
  it('uses the safe fallback for non-error failures', () => {
    expect(
      releaseOperationErrorText({ code: 'ENOSPC', secret: '/private' })
    ).toBe('Vorgang fehlgeschlagen. Bitte erneut versuchen.')
  })
})
