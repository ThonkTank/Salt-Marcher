import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  renderQualificationJsonSchema,
  renderQualificationTemplate
} from '../src/shared/qualification/render-evidence.js'

const root = resolve(import.meta.dirname, '..')
const artifacts = [
  {
    path: 'docs/project/evidence/m1-render-qualification.schema.json',
    contents: renderQualificationJsonSchema()
  },
  {
    path: 'docs/project/evidence/m1-render-qualification-template.json',
    contents: renderQualificationTemplate()
  }
]

for (const artifact of artifacts) {
  const expected = `${JSON.stringify(artifact.contents, null, 2)}\n`
  if (readFileSync(resolve(root, artifact.path), 'utf8') !== expected)
    throw new Error(
      `${artifact.path} is stale; run pnpm qualify:render:artifacts`
    )
}
