import { resolve } from 'node:path'

export type HandoffArguments =
  | Readonly<{ mode: 'canonical'; resume: boolean }>
  | Readonly<{ mode: 'dry-run'; source: string | null }>

export function parseHandoffArguments(
  arguments_: readonly string[]
): HandoffArguments {
  if (arguments_.length === 0) return { mode: 'canonical', resume: false }
  if (arguments_.length === 1 && arguments_[0] === '--resume')
    return { mode: 'canonical', resume: true }
  if (arguments_[0] !== '--dry-run')
    throw new Error(
      'Usage: pnpm handoff:app [--resume | --dry-run [--source <campaign-data-path>]]'
    )
  if (arguments_.includes('--resume'))
    throw new Error('--dry-run and --resume cannot be combined')
  if (arguments_.length === 1) return { mode: 'dry-run', source: null }
  if (
    arguments_.length === 3 &&
    arguments_[1] === '--source' &&
    arguments_[2] !== undefined
  )
    return { mode: 'dry-run', source: resolve(arguments_[2]) }
  throw new Error(
    'Usage: pnpm handoff:app --dry-run [--source <campaign-data-path>]'
  )
}
