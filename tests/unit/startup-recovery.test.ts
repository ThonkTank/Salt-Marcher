import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recoverWithDialog } from '../../src/main/application-lifecycle/startup-recovery.js'
const mocks = vi.hoisted(() => ({ dialog: vi.fn(), open: vi.fn() }))
vi.mock('electron', () => ({
  dialog: { showMessageBox: mocks.dialog },
  shell: { openPath: mocks.open }
}))
beforeEach(() => vi.resetAllMocks())
describe('recovery before Core startup', () => {
  it('fails unattended checks without opening a modal dialog', async () => {
    const failure = new Error('Unresolved journal')
    await expect(
      recoverWithDialog(
        () => {
          throw failure
        },
        '/installation',
        false
      )
    ).rejects.toBe(failure)
    expect(mocks.dialog).not.toHaveBeenCalled()
  })
  it('returns normal recovery without displaying a dialog', async () => {
    expect(await recoverWithDialog(() => 'verify', '/installation')).toBe(
      'verify'
    )
    expect(mocks.dialog).not.toHaveBeenCalled()
  })
  it('retries the existing recovery without creating a new maintenance operation', async () => {
    const recover = vi
      .fn<() => string>()
      .mockImplementationOnce(() => {
        throw new Error('Journal conflict')
      })
      .mockReturnValueOnce('relaunch')
    mocks.dialog.mockResolvedValue({ response: 0 })
    expect(await recoverWithDialog(recover, '/installation')).toBe('relaunch')
    expect(recover).toHaveBeenCalledTimes(2)
  })
  it('allows closing while recovery remains unresolved', async () => {
    mocks.dialog.mockResolvedValue({ response: 2 })
    const recover = vi.fn(() => {
      throw new Error('Journal conflict')
    })
    expect(await recoverWithDialog(recover, '/installation')).toBeNull()
    expect(recover).toHaveBeenCalledOnce()
  })
  it.each(['', 'Access denied'])(
    'opens backups explicitly and keeps recovery unresolved (%s)',
    async (failure) => {
      mocks.dialog
        .mockResolvedValueOnce({ response: 1 })
        .mockResolvedValueOnce({ response: 2 })
      mocks.open.mockResolvedValue(failure)
      const recover = vi.fn(() => {
        throw new Error('Journal conflict')
      })
      expect(await recoverWithDialog(recover, '/installation')).toBeNull()
      expect(mocks.open).toHaveBeenCalledWith('/installation/backups')
      expect(recover).toHaveBeenCalledOnce()
      expect(mocks.dialog).toHaveBeenCalledTimes(2)
    }
  )
})
