import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

describe('utility composition root', () => {
  it('keeps protocol, scheduling, and events in explicit owner modules', () => {
    const path = 'src/utility/application.ts'
    const source = readFileSync(path, 'utf8')
    const tree = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
    expect(
      tree.statements.filter((statement) => ts.isFunctionDeclaration(statement))
    ).toHaveLength(0)
    for (const owner of [
      './domain-events.js',
      './domain-scheduling.js',
      './runtime-dispatcher.js'
    ])
      expect(source).toContain(owner)
    expect(source).not.toContain("process.parentPort.on('message'")
  })
})
