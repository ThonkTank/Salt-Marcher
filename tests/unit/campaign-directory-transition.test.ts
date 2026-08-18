import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignDirectoryTransition } from '../../src/core/persistence/sqlite/campaign-directory-transition.js'

const roots: string[] = []
const campaignId = '00000000-0000-4000-8000-000000000001'

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('CampaignDirectoryTransition', () => {
  it.each([
    ['staged', 0, false],
    ['original_moved', 1, false],
    ['replacement_promoted', 2, false],
    ['verified', 3, true],
    ['complete', 4, true]
  ] as const)(
    'recovers a process stop in the %s phase without deleting the last valid copy',
    (_phase, completedSteps, committed) => {
      const root = fixture()
      let transition = owner(root)
      let receipt = transition.begin({
        campaignId,
        previousName: 'Original',
        replacementName: 'Replacement',
        previousActiveId: campaignId
      })
      if (completedSteps >= 1) receipt = transition.moveOriginal(receipt)
      if (completedSteps >= 2) receipt = transition.promoteReplacement(receipt)
      if (completedSteps >= 3) receipt = transition.markVerified(receipt)
      if (completedSteps >= 4) transition.completeFilesystem(receipt)

      // A new owner sees only durable state, as it would after process restart.
      transition = owner(root)
      const persisted = transition.receipts()[0]!
      if (committed) transition.rollForwardFilesystem(persisted)
      else transition.rollbackFilesystem(persisted)
      transition.finish(persisted)

      expect(readCurrent(root)).toBe(committed ? 'replacement' : 'original')
      expect(transition.receipts()).toEqual([])
      expect(existsSync(stageDirectory(root))).toBe(false)
      expect(existsSync(replacedDirectory(root))).toBe(false)
    }
  )

  it('fails closed when copy roles are ambiguous instead of deleting either candidate', () => {
    const root = fixture()
    const transition = owner(root)
    const receipt = transition.begin({
      campaignId,
      previousName: 'Original',
      replacementName: 'Replacement',
      previousActiveId: null
    })
    const moved = transition.moveOriginal(receipt)
    mkdirSync(currentDirectory(root), { recursive: true })
    writeFileSync(currentPath(root), 'unknown')

    expect(() => transition.rollbackFilesystem(moved)).toThrow(
      'three ambiguous copies'
    )
    expect(readFileSync(currentPath(root), 'utf8')).toBe('unknown')
    expect(readFileSync(stagePath(root), 'utf8')).toBe('replacement')
    expect(readFileSync(replacedPath(root), 'utf8')).toBe('original')
  })
})

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-transition-'))
  roots.push(root)
  mkdirSync(currentDirectory(root), { recursive: true })
  mkdirSync(stageDirectory(root), { recursive: true })
  writeFileSync(currentPath(root), 'original')
  writeFileSync(stagePath(root), 'replacement')
  return root
}

function owner(root: string): CampaignDirectoryTransition {
  return new CampaignDirectoryTransition(root, (path) => {
    if (!existsSync(path)) return false
    return ['original', 'replacement'].includes(readFileSync(path, 'utf8'))
  })
}

function readCurrent(root: string): string {
  return readFileSync(currentPath(root), 'utf8')
}

function currentDirectory(root: string): string {
  return join(root, 'campaigns', campaignId)
}

function currentPath(root: string): string {
  return join(currentDirectory(root), 'campaign.sqlite')
}

function stageDirectory(root: string): string {
  return join(root, 'campaigns', '.creating', campaignId)
}

function stagePath(root: string): string {
  return join(stageDirectory(root), 'campaign.sqlite')
}

function replacedDirectory(root: string): string {
  return join(root, 'campaigns', '.replacing', campaignId)
}

function replacedPath(root: string): string {
  return join(replacedDirectory(root), 'campaign.sqlite')
}
