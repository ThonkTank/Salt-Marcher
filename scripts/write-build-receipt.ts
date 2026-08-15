import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createBuildReceipt } from './build-receipt.js'

const outputRoot = resolve(process.cwd(), 'out')
const receipt = createBuildReceipt(outputRoot)
const target = resolve(outputRoot, 'build-receipt.json')
const temporary = `${target}.next`
mkdirSync(outputRoot, { recursive: true })
writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
renameSync(temporary, target)
console.info(
  JSON.stringify({
    component: 'build-receipt',
    event: 'written',
    channel: receipt.build.channel,
    outputHash: receipt.outputHash,
    files: receipt.files.length
  })
)
