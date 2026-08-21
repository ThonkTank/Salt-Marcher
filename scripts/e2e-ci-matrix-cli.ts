import { appendFileSync } from 'node:fs'
import { e2eCiMatrix } from './e2e-ci-matrix.js'

const ciMatrices = {
  functional: e2eCiMatrix('functional'),
  visual: e2eCiMatrix('visual')
}
const githubOutput = process.env['GITHUB_OUTPUT']
if (githubOutput)
  appendFileSync(
    githubOutput,
    `functional=${JSON.stringify(ciMatrices.functional)}\nvisual=${JSON.stringify(ciMatrices.visual)}\n`
  )
console.log(JSON.stringify(ciMatrices))
