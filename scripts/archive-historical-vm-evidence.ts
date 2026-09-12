import { parseArgs } from 'node:util'
import { z } from 'zod'
import { archiveVmEvidence } from './qualification/vm-evidence.js'

const { values } = parseArgs({
  options: { run: { type: 'string' }, output: { type: 'string' } }
})
const manifest = await archiveVmEvidence(
  z.string().parse(values.run),
  z.string().parse(values.output)
)
console.info(
  `Archived ${manifest.files.length} files; semantic acceptance remains unverified.`
)
