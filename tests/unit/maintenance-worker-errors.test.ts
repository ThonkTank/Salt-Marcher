import { afterEach, describe, expect, it, vi } from 'vitest'
import { releaseOperationErrorText } from '../../src/main/release/operation-error.js'

const failure = vi.hoisted(() => ({ value: undefined as unknown }))
vi.mock('../../src/core/maintenance/profile-maintenance.js', () => ({
  ProfileMaintenance: class {
    backups() {
      throw failure.value
    }
  }
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('maintenance worker error transport', () => {
  it.each([
    ['EACCES', 'Prüfe die Zugriffsrechte'],
    ['EPERM', 'Prüfe die Zugriffsrechte'],
    ['ENOSPC', 'Gib Speicherplatz frei'],
    ['EDQUOT', 'Gib Speicherplatz frei']
  ])(
    'translates %s before sending only the message to Main',
    async (code, action) => {
      failure.value = Object.assign(new Error('open /private/campaign-data'), {
        code
      })
      const response = await dispatch()
      expect(response).toMatchObject({ ok: false })
      expect(response.message).toContain(action)
      expect(response.message).toContain('versuche den Vorgang erneut')
      expect(response.message).not.toContain('/private')
      expect(response.message).not.toContain(code)
      expect(releaseOperationErrorText(new Error(response.message))).toBe(
        response.message
      )
    }
  )

  it.each([
    ['newer', 'Aktualisiere SaltMarcher'],
    ['missing', 'Wähle eine unterstützte Sicherung'],
    ['corrupt', 'Wähle eine andere geprüfte Sicherung']
  ])('explains %s data before serializing the error', async (kind, action) => {
    const { IncompatibleDataError, CorruptDataError } =
      await import('../../src/core/persistence/sqlite/database.js')
    failure.value =
      kind === 'corrupt'
        ? new CorruptDataError('/private/campaign-data/installation.sqlite')
        : new IncompatibleDataError(
            '/private/campaign-data/installation.sqlite',
            kind === 'newer' ? 43 : 0,
            42
          )
    const response = await dispatch()
    expect(response.ok).toBe(false)
    expect(response.message).toContain(action)
    expect(response.message).not.toContain('/private')
    expect(response.message).not.toContain('persisted')
    expect(releaseOperationErrorText(new Error(response.message))).toBe(
      response.message
    )
  })

  it('preserves an actionable domain message across the same boundary', async () => {
    const message = 'Bitte eine geprüfte Sicherung auswählen.'
    failure.value = new Error(message)
    expect(await dispatch()).toEqual({
      ok: false,
      message
    })
  })
})

async function dispatch(): Promise<{ ok: boolean; message: string }> {
  let listener: ((event: { data: unknown }) => void) | undefined
  let deliver: ((value: { ok: boolean; message: string }) => void) | undefined
  const response = new Promise<{ ok: boolean; message: string }>((resolve) => {
    deliver = resolve
  })
  vi.stubGlobal('process', {
    ...process,
    parentPort: {
      on(_event: string, callback: (event: { data: unknown }) => void) {
        listener = callback
      },
      postMessage(value: { ok: boolean; message: string }) {
        deliver!(value)
      }
    }
  })
  await import('../../src/utility/maintenance/worker.js')
  if (!listener) throw new Error('Maintenance worker did not subscribe')
  listener({ data: { operation: 'list', root: '/unused', version: '0.2.0' } })
  return response
}
