import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('session controller ownership', () => {
  it('keeps mutation races and reference following out of the workspace projection', () => {
    const workspace = source('use-session-workspace-controller.ts')
    const mutations = source('use-session-mutation-controller.ts')
    const references = source('use-session-reference-follow.ts')
    const groups = source('use-session-group-controller.ts')
    const dialogs = source('use-session-dialog-controller.ts')
    const scenes = source('use-session-scene-controller.ts')
    expect(workspace).not.toContain('latestSnapshot')
    expect(workspace).not.toContain('eslint-disable-next-line')
    expect(workspace).toContain('useSessionMutationController')
    expect(workspace).toContain('useSessionReferenceFollow')
    expect(workspace).toContain('useSessionGroupController')
    expect(workspace).toContain('useSessionDialogController')
    expect(workspace).toContain('useSessionSceneController')
    expect(mutations).toContain('latestSnapshotRequest')
    expect(references).toContain('followedCombatCard')
    expect(groups).toContain('expandedByScene')
    expect(dialogs).toContain('SessionDialogState')
    expect(scenes).toContain('assignPartyMember')
  })
})

function source(name: string): string {
  return readFileSync(`src/renderer/features/session/${name}`, 'utf8')
}
