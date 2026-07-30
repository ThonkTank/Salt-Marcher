import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { CoreProcessClient } from '../core-process/core-process-client.js'
import { createMainWindow } from '../windows/main-window.js'
import {
  createSecondaryWindow,
  isReadOnlyWindow
} from '../windows/secondary-window.js'
import { configureSecurity } from '../security/security.js'
import { outputPath } from './runtime-paths.js'
import { isE2eRuntime } from './e2e-runtime.js'
import {
  activateCampaignInputSchema,
  campaignCapabilityResponseSchema,
  createCampaignInputSchema,
  type CampaignSnapshot
} from '../../shared/contracts/campaign.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'

let core: CoreProcessClient | undefined

export async function startApplication(): Promise<void> {
  await app.whenReady()
  configureSecurity()
  core = new CoreProcessClient(
    join(app.getPath('userData'), 'development-data'),
    outputPath('main', 'utility.js')
  )
  await core.waitUntilReady()
  ipcMain.handle('campaign:list', (event) =>
    invokeCapability(() => {
      authorize(event, false)
      return requireCore().list()
    })
  )
  ipcMain.handle('campaign:create', (event, raw) =>
    invokeCapability(() => {
      authorize(event, true)
      const input = createCampaignInputSchema.safeParse(raw)
      if (!input.success) throw new CapabilityError('validation_failed', false)
      return requireCore().create(input.data.name)
    })
  )
  ipcMain.handle('campaign:activate', (event, raw) =>
    invokeCapability(() => {
      authorize(event, true)
      const input = activateCampaignInputSchema.safeParse(raw)
      if (!input.success) throw new CapabilityError('validation_failed', false)
      return requireCore().activate(input.data.id)
    })
  )
  createMainWindow()
  if (!isE2eRuntime()) createSecondaryWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
}

export function stopApplication(): void {
  core?.close()
  core = undefined
}

function requireCore(): CoreProcessClient {
  if (core === undefined) throw new CapabilityError('core_unavailable', true)
  return core
}

function authorize(event: IpcMainInvokeEvent, requiresWrite: boolean): void {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window === null || window.isDestroyed())
    throw new CapabilityError('protocol_violation', false)
  if (requiresWrite && isReadOnlyWindow(event.sender)) {
    throw new CapabilityError('read_only', false)
  }
}

async function invokeCapability(
  operation: () => Promise<CampaignSnapshot>
): Promise<unknown> {
  try {
    return campaignCapabilityResponseSchema.parse({
      ok: true,
      snapshot: await operation()
    })
  } catch (error) {
    const failure =
      error instanceof CapabilityError
        ? { code: error.code, retryable: error.retryable }
        : { code: 'internal' as const, retryable: false }
    return campaignCapabilityResponseSchema.parse({ ok: false, error: failure })
  }
}
