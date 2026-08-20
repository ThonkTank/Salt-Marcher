import { existsSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { electronTestApplication } from '../../scripts/electron-test-application.js'

describe('Electron test application', () => {
  it('launches the entry point through the real package binary', () => {
    const application = electronTestApplication(
      '/workspace/out/main/index.js',
      ['--no-sandbox']
    )
    expect(existsSync(application.appBinaryPath)).toBe(true)
    expect(realpathSync(application.appBinaryPath)).toBe(
      application.appBinaryPath
    )
    expect(application.appBinaryPath).not.toBe(
      resolve('node_modules', '.bin', 'electron')
    )
    expect(application.appArgs).toEqual([
      '--app=/workspace/out/main/index.js',
      '--no-sandbox'
    ])
  })
})
