import { describe, expectTypeOf, it } from 'vitest'
import type {
  CapabilityOperationMode,
  SaltMarcherApi
} from '../../src/shared/contracts/capability-api.js'
import type {
  FifoCommandExecution,
  LongWorkExecution,
  ReadProjectionExecution,
  ReceiptReconciliationExecution,
  RendererAuthorityKey
} from '../../src/renderer/async/renderer-execution-contract.js'

type SettingsRead = SaltMarcherApi['settings']['read']
type SettingsUpdate = SaltMarcherApi['settings']['update']
type NpcCreate = SaltMarcherApi['npcs']['create']
type NpcReceiptRead = SaltMarcherApi['npcs']['commandReceipt']

describe('renderer execution contract', () => {
  it('preserves registry operation modes through the derived API', () => {
    expectTypeOf<
      CapabilityOperationMode<SettingsRead>
    >().toEqualTypeOf<'read'>()
    expectTypeOf<
      CapabilityOperationMode<SettingsUpdate>
    >().toEqualTypeOf<'write'>()
  })

  it('defines explicit authority and execution entry-point shapes', () => {
    expectTypeOf<RendererAuthorityKey<'settings'>>().toEqualTypeOf<
      Readonly<{ scope: 'settings'; entityKey: string | null }>
    >()
    expectTypeOf<
      ReadProjectionExecution<SettingsRead, 'settings.read'>['kind']
    >().toEqualTypeOf<'read-projection'>()
    expectTypeOf<
      FifoCommandExecution<SettingsUpdate, 'settings.write'>['kind']
    >().toEqualTypeOf<'fifo-command'>()
    expectTypeOf<
      LongWorkExecution<NpcCreate>['operationMode']
    >().toEqualTypeOf<'write'>()
    expectTypeOf<
      ReceiptReconciliationExecution<NpcCreate, NpcReceiptRead>['kind']
    >().toEqualTypeOf<'receipt-reconciliation'>()
  })

  it('fails closed for untyped or mode-inverted execution wiring', () => {
    expectTypeOf<
      ReadProjectionExecution<() => Promise<unknown>>
    >().toEqualTypeOf<never>()
    expectTypeOf<
      ReadProjectionExecution<SettingsUpdate>
    >().toEqualTypeOf<never>()
    expectTypeOf<FifoCommandExecution<SettingsRead>>().toEqualTypeOf<never>()
    expectTypeOf<
      ReceiptReconciliationExecution<SettingsRead, NpcReceiptRead>
    >().toEqualTypeOf<never>()
    expectTypeOf<
      ReceiptReconciliationExecution<NpcCreate, SettingsUpdate>
    >().toEqualTypeOf<never>()
  })
})
