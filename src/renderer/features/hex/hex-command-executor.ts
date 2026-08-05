import type { HexBrushStrokeResult } from '../../../shared/contracts/hex.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'

/** Resolves an uncertain IPC outcome through the utility-owned command receipt. */
export async function executeRecoverableHexCommand(
  commandId: string,
  execute: () => Promise<HexBrushStrokeResult>,
  readReceipt: (commandId: string) => Promise<HexBrushStrokeResult | null>,
  receiptFailed?: () => void
): Promise<HexBrushStrokeResult> {
  try {
    return await execute()
  } catch (cause) {
    if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
    try {
      const receipt = await readReceipt(commandId)
      if (receipt) return receipt
    } catch {
      receiptFailed?.()
    }
    throw cause
  }
}
