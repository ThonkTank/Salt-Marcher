import { BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import type { WindowRole } from '../../shared/contracts/operations.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { isReadOnlyWindow } from '../windows/secondary-window.js'

export function roleForEvent(event: IpcMainInvokeEvent): WindowRole {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window === null || window.isDestroyed())
    throw new CapabilityError('protocol_violation', false)
  return isReadOnlyWindow(event.sender)
    ? 'passive'
    : process.argv.includes('--m1-qualification')
      ? 'qualification'
      : 'gm'
}
