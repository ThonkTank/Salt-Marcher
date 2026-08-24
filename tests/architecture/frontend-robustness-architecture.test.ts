import { expect } from 'vitest'
import { architectureGate } from './support/architecture-gate.js'
import {
  codeFiles,
  parseTypeScriptModule,
  readTypeScriptModule
} from './support/typescript-module.js'

architectureGate(
  'typed-contract',
  'keeps renderer execution modes nominal and the FR1A contract type-only',
  () => {
    const capabilityApi = readTypeScriptModule(
      'src/shared/contracts/capability-api.ts'
    )
    expect(capabilityApi.typeProperties).toContainEqual({
      name: 'mode',
      optional: false
    })
    for (const declaration of [
      'CapabilityOperation',
      'CapabilityOperationMode'
    ])
      expect(
        capabilityApi.exportedDeclarations.has(declaration),
        declaration
      ).toBe(true)

    const contractPath = 'src/renderer/async/renderer-execution-contract.ts'
    const contract = readTypeScriptModule(contractPath)
    expect(contract.imports.every(({ typeOnly }) => typeOnly)).toBe(true)
    expect(contract.calls).toEqual([])
    expect(contract.constructions).toEqual([])
    for (const declaration of [
      'RendererAuthorityKey',
      'ReadProjectionExecution',
      'FifoCommandExecution',
      'LongWorkExecution',
      'ReceiptReconciliationExecution'
    ])
      expect(contract.exportedDeclarations.has(declaration), declaration).toBe(
        true
      )

    for (const path of codeFiles('src/renderer'))
      for (const dependency of readTypeScriptModule(path).imports.filter(
        ({ specifier }) => specifier.includes('renderer-execution-contract')
      ))
        expect(dependency.typeOnly, `${path} imports runtime contract`).toBe(
          true
        )
  }
)

architectureGate(
  'behavior-integration',
  'keeps installation settings reads behind the provider-owned keyed projection',
  () => {
    const provider = readTypeScriptModule(
      'src/renderer/capabilities/capability-provider.tsx'
    )
    expect(provider.constructions).toContain('InstallationSettingsProjection')

    const adapter = readTypeScriptModule(
      'src/renderer/capabilities/installation-settings-projection.ts'
    )
    expect(adapter.constructions).toContain('AsyncCommandCoordinator')
    expect(adapter.constructions).toContain('KeyedReadProjectionOwner')
    expect(adapter.stringLiterals).toContain('installation.settings')
    expect(adapter.stringLiterals).toContain('read-projection')

    const owner = readTypeScriptModule(
      'src/renderer/async/keyed-read-projection-owner.ts'
    )
    expect(owner.exportedDeclarations.has('KeyedReadProjectionOwner')).toBe(
      true
    )
    expect(owner.stringLiterals).toContain('latest-only')

    const hook = readTypeScriptModule(
      'src/renderer/shell/use-installation-settings-projection.ts'
    )
    expect(hook.calls).toContain('useSyncExternalStore')

    const preferences = readTypeScriptModule(
      'src/renderer/shell/use-installation-preferences.ts'
    )
    expect(preferences.calls).toContain('useInstallationSettingsProjection')
    expect(hasDirectSettingsRead(preferences.propertyAccesses)).toBe(false)

    const controlledMutation = parseTypeScriptModule(
      'controlled-direct-settings-read.ts',
      'void capabilityApi.settings.read()'
    )
    expect(hasDirectSettingsRead(controlledMutation.propertyAccesses)).toBe(
      true
    )
  }
)

function hasDirectSettingsRead(propertyAccesses: readonly string[]): boolean {
  return propertyAccesses.some((access) => access.endsWith('.settings.read'))
}
