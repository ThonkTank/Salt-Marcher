import { expect } from 'vitest'
import { architectureGate } from './support/architecture-gate.js'
import { codeFiles, readTypeScriptModule } from './support/typescript-module.js'

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
