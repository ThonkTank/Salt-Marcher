import { ZodError } from 'zod'
import {
  CorruptDataError,
  IncompatibleDataError
} from '../core/persistence/sqlite/database.js'
import type { CoreStartupFailure } from '../shared/contracts/core-protocol.js'

export function classifyStartupFailure(error: unknown): CoreStartupFailure {
  const reason = startupFailureReason(error)
  return {
    kind: 'core.startup-failed',
    reason,
    retryable: reason === 'internal'
  }
}

function startupFailureReason(error: unknown): CoreStartupFailure['reason'] {
  if (error instanceof IncompatibleDataError) return 'incompatible-data'
  if (error instanceof CorruptDataError) return 'corrupt-data'
  if (error instanceof ZodError || error instanceof SyntaxError)
    return 'invalid-configuration'
  const code = errorCode(error)
  if (code === 'EACCES' || code === 'EPERM') return 'access-denied'
  if (code === 'ENOENT') return 'resource-missing'
  if (code.startsWith('SQLITE_CORRUPT') || code === 'SQLITE_NOTADB')
    return 'corrupt-data'
  return 'internal'
}

function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return ''
  return typeof error.code === 'string' ? error.code : ''
}
