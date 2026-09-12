import {
  configureReleaseEnvironment,
  verifyReleaseEnvironment
} from './release/environment-policy.js'
const args = process.argv.slice(2)
if (
  args.some((arg) => !['--apply', '--check'].includes(arg)) ||
  args.length > 1
)
  throw new Error(
    'Use --apply, --check, or no arguments for a read-only preview.'
  )
console.info(
  JSON.stringify(
    args.includes('--check')
      ? verifyReleaseEnvironment()
      : configureReleaseEnvironment(args.includes('--apply')),
    null,
    2
  )
)
