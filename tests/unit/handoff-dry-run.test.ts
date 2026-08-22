import { describe, expect, it } from 'vitest'
import { parseHandoffArguments } from '../../scripts/handoff-arguments.js'
import {
  dryRunCommands,
  dryRunEnvironment
} from '../../scripts/handoff-dry-run.js'

describe('isolated handoff dry run', () => {
  it('keeps canonical resume and dry-run inputs mutually exclusive', () => {
    expect(parseHandoffArguments([])).toEqual({
      mode: 'canonical',
      resume: false
    })
    expect(parseHandoffArguments(['--resume'])).toEqual({
      mode: 'canonical',
      resume: true
    })
    expect(parseHandoffArguments(['--dry-run'])).toEqual({
      mode: 'dry-run',
      source: null
    })
    expect(() => parseHandoffArguments(['--dry-run', '--resume'])).toThrow(
      'cannot be combined'
    )
  })

  it('routes every mutable runtime directory into the isolated root', () => {
    const environment = dryRunEnvironment('/tmp/isolated', {
      PATH: '/usr/bin'
    })
    expect(environment).toMatchObject({
      PATH: '/usr/bin',
      XDG_DATA_HOME: '/tmp/isolated/xdg-data',
      XDG_CONFIG_HOME: '/tmp/isolated/xdg-config',
      XDG_CACHE_HOME: '/tmp/isolated/xdg-cache',
      XDG_STATE_HOME: '/tmp/isolated/xdg-state',
      XDG_RUNTIME_DIR: '/tmp/isolated/xdg-runtime'
    })
    expect(environment['COREPACK_HOME']).toMatch(/\.cache\/node\/corepack$/)
  })

  it('builds, packages, installs and verifies without a canonical receipt phase', () => {
    const commands = dryRunCommands('/tmp/isolated/evidence.json')
    expect(commands.map(({ phase }) => phase)).toEqual([
      'build',
      'package',
      'packaged-smoke',
      'isolated-install',
      'isolated-runtime'
    ])
    expect(JSON.stringify(commands)).not.toContain('storage-retention')
    expect(JSON.stringify(commands)).not.toContain('handoff-receipt')
    expect(commands.at(-1)?.arguments).toContain('/tmp/isolated/evidence.json')
  })
})
