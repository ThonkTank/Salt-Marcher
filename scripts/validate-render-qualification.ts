import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateRenderQualificationEvidence } from '../src/shared/qualification/render-evidence.js'

const path = process.argv[2]
if (path === undefined) {
  console.error('Usage: pnpm qualify:render:validate <evidence.json>')
  process.exit(1)
}

try {
  validateRenderQualificationEvidence(
    JSON.parse(readFileSync(resolve(path), 'utf8')) as unknown
  )
  console.log(`Valid M1 render qualification evidence: ${path}`)
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : 'Invalid M1 render qualification evidence'
  )
  process.exit(1)
}
