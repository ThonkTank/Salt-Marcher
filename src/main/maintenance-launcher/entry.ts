import { isAbsolute, resolve } from 'node:path'
import { launchDesktop } from './start.js'

try {
  const root = process.argv[2]
  if (!root || !isAbsolute(root))
    throw new Error('Ein absoluter Installationspfad ist erforderlich.')
  process.exitCode = launchDesktop(resolve(root), process.argv.slice(3))
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : 'Der sichere Appstart ist fehlgeschlagen.'
  )
  process.exitCode = 1
}
