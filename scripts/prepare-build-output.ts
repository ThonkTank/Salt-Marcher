import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const outputRoot = resolve(process.cwd(), 'out')
rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(outputRoot, { recursive: true })
