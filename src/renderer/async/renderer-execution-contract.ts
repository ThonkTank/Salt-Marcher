import type { CapabilityOperationMode } from '../../shared/contracts/capability-api.js'

type AsyncOperation = (...arguments_: never[]) => Promise<unknown>

type HasOperationMode<
  Operation extends AsyncOperation,
  Mode extends 'read' | 'write'
> = [CapabilityOperationMode<Operation>] extends [never]
  ? false
  : CapabilityOperationMode<Operation> extends Mode
    ? true
    : false

export type RendererAuthorityKey<Scope extends string = string> = Readonly<{
  scope: Scope
  entityKey: string | null
}>

export type ReadProjectionExecution<
  Operation extends AsyncOperation,
  Scope extends string = string
> =
  HasOperationMode<Operation, 'read'> extends true
    ? Readonly<{
        kind: 'read-projection'
        authority: RendererAuthorityKey<Scope>
        operation: Operation
      }>
    : never

export type FifoCommandExecution<
  Operation extends AsyncOperation,
  Scope extends string = string
> =
  HasOperationMode<Operation, 'write'> extends true
    ? Readonly<{
        kind: 'fifo-command'
        authority: RendererAuthorityKey<Scope>
        operation: Operation
      }>
    : never

export type LongWorkExecution<
  Operation extends AsyncOperation,
  Scope extends string = string
> =
  HasOperationMode<Operation, 'read' | 'write'> extends true
    ? Readonly<{
        kind: 'long-work'
        authority: RendererAuthorityKey<Scope>
        operationId: string
        operation: Operation
        operationMode: CapabilityOperationMode<Operation>
      }>
    : never

export type ReceiptReconciliationExecution<
  Command extends AsyncOperation,
  ReceiptRead extends AsyncOperation,
  Scope extends string = string
> =
  HasOperationMode<Command, 'write'> extends true
    ? HasOperationMode<ReceiptRead, 'read'> extends true
      ? Readonly<{
          kind: 'receipt-reconciliation'
          authority: RendererAuthorityKey<Scope>
          commandId: string
          command: Command
          receiptRead: ReceiptRead
        }>
      : never
    : never
