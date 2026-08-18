import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('generated run schema ownership', () => {
  it('keeps DDL out of query and command orchestration', () => {
    const repository = readFileSync(
      'src/core/session-generation/generated-run-store.ts',
      'utf8'
    )
    const schema = readFileSync(
      'src/core/session-generation/generated-run-schema.ts',
      'utf8'
    )
    const codec = readFileSync(
      'src/core/session-generation/generated-run-row-codec.ts',
      'utf8'
    )
    const sessionRepository = readFileSync(
      'src/core/session-generation/session-generated-run-repository.ts',
      'utf8'
    )
    const groupRepository = readFileSync(
      'src/core/session-generation/group-reward-generated-run-repository.ts',
      'utf8'
    )
    expect(repository).not.toContain('CREATE TABLE')
    expect(repository).toContain("from './generated-run-schema.js'")
    expect(schema).toContain(
      'CREATE TABLE IF NOT EXISTS session_generation_run'
    )
    expect(schema).toContain(
      'CREATE TABLE IF NOT EXISTS session_generation_group_source'
    )
    expect(repository).not.toContain('const runRootSelect')
    expect(codec).toContain("z.discriminatedUnion('runKind'")
    expect(codec).toContain("rewardEngineVersion === 'reward-v3'")
    expect(repository).not.toContain('INSERT INTO session_generation_run')
    expect(repository).toContain('SessionGeneratedRunRepository')
    expect(repository).toContain('GroupRewardGeneratedRunRepository')
    for (const owner of [sessionRepository, groupRepository]) {
      expect(owner).toContain('INSERT INTO session_generation_run')
      expect(owner).toContain('.transaction(')
      expect(owner).toContain('.immediate()')
    }
  })
})
