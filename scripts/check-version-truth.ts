import { readFileSync } from 'node:fs'
import {
  assertVersionTruthDocument,
  readVersionTruth
} from './version-truth.js'

assertVersionTruthDocument(
  readFileSync('docs/project/architecture/version-truth.md', 'utf8'),
  readVersionTruth()
)
console.info('Executable schema, engine, config, and catalog truth verified.')
