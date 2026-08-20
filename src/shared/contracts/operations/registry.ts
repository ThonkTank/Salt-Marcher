import { z } from 'zod'

export type OperationMode = 'read' | 'write'
export type WindowRole = 'gm' | 'passive' | 'qualification'
export type OperationHandlerOwner = 'utility' | 'main'
export type TravelReconciliationReason = 'campaign-reconcile' | 'travel-command'

export interface OperationDiagnostics {
  readonly category: string
  readonly redactInput: true
}

export interface OperationDeclaration<
  Input extends z.ZodType = z.ZodType,
  Output extends z.ZodType = z.ZodType,
  Roles extends readonly WindowRole[] = readonly WindowRole[]
> {
  readonly channel: string | null
  readonly input: Input
  readonly output: Output
  readonly mode: OperationMode
  readonly roles: Roles
  readonly deadlineMs: number
  readonly travelReconciliation: TravelReconciliationReason | null
}

export interface OperationDefinition<
  Input extends z.ZodType = z.ZodType,
  Output extends z.ZodType = z.ZodType,
  Roles extends readonly WindowRole[] = readonly WindowRole[]
> extends OperationDeclaration<Input, Output, Roles> {
  readonly key: string
  readonly handler: OperationHandlerOwner
  readonly diagnostics: OperationDiagnostics
  readonly namespace?: string
  readonly method?: string
}

export type OperationDefinitions = Readonly<Record<string, OperationDefinition>>
export type OperationDeclarations = Readonly<
  Record<string, OperationDeclaration>
>

export const none = z.undefined()

export function read<Input extends z.ZodType, Output extends z.ZodType>(
  channel: string | null,
  input: Input,
  output: Output
): OperationDeclaration<Input, Output, readonly ['gm']>
export function read<
  Input extends z.ZodType,
  Output extends z.ZodType,
  const Roles extends readonly WindowRole[]
>(
  channel: string | null,
  input: Input,
  output: Output,
  roles: Roles
): OperationDeclaration<Input, Output, Roles>
export function read<Input extends z.ZodType, Output extends z.ZodType>(
  channel: string | null,
  input: Input,
  output: Output,
  roles: readonly WindowRole[] = ['gm']
): OperationDeclaration<Input, Output> {
  return {
    channel,
    input,
    output,
    mode: 'read',
    roles,
    deadlineMs: 10_000,
    travelReconciliation: null
  }
}

export function write<Input extends z.ZodType, Output extends z.ZodType>(
  channel: string | null,
  input: Input,
  output: Output
): OperationDeclaration<Input, Output, readonly ['gm']>
export function write<
  Input extends z.ZodType,
  Output extends z.ZodType,
  const Roles extends readonly WindowRole[]
>(
  channel: string | null,
  input: Input,
  output: Output,
  roles: Roles,
  travelReconciliation?: TravelReconciliationReason | null
): OperationDeclaration<Input, Output, Roles>
export function write<Input extends z.ZodType, Output extends z.ZodType>(
  channel: string | null,
  input: Input,
  output: Output,
  roles: readonly WindowRole[] = ['gm'],
  travelReconciliation: TravelReconciliationReason | null = 'travel-command'
): OperationDeclaration<Input, Output> {
  return {
    channel,
    input,
    output,
    mode: 'write',
    roles,
    deadlineMs: 10_000,
    travelReconciliation
  }
}

export function defineOperationFragment<
  const Handler extends OperationHandlerOwner,
  const Declarations extends OperationDeclarations
>(
  handler: Handler,
  declarations: Declarations
): {
  readonly [Key in keyof Declarations]: Declarations[Key] &
    Readonly<{
      key: Key
      handler: Handler
      diagnostics: OperationDiagnostics
    }>
} {
  return Object.fromEntries(
    Object.entries(declarations).map(([key, declaration]) => [
      key,
      {
        ...declaration,
        key,
        handler,
        diagnostics: {
          category: operationNamespace(key),
          redactInput: true
        }
      }
    ])
  ) as {
    readonly [Key in keyof Declarations]: Declarations[Key] &
      Readonly<{
        key: Key
        handler: Handler
        diagnostics: OperationDiagnostics
      }>
  }
}

export const utilityOperationFragment = <
  const Declarations extends OperationDeclarations
>(
  declarations: Declarations
) => defineOperationFragment('utility', declarations)

export const mainOperationFragment = <
  const Declarations extends OperationDeclarations
>(
  declarations: Declarations
) => defineOperationFragment('main', declarations)

type MergeFragments<
  Fragments extends readonly OperationDefinitions[],
  Result = object
> = Fragments extends readonly [
  infer Head extends OperationDefinitions,
  ...infer Tail extends readonly OperationDefinitions[]
]
  ? MergeFragments<Tail, Result & Head>
  : Result

export function composeOperationDefinitions<
  const Fragments extends readonly OperationDefinitions[]
>(...fragments: Fragments): MergeFragments<Fragments> {
  const definitions: Record<string, OperationDefinition> = {}
  for (const fragment of fragments)
    for (const [kind, definition] of Object.entries(fragment)) {
      if (Object.hasOwn(definitions, kind))
        throw new Error(`duplicate_operation_kind:${kind}`)
      definitions[kind] = definition
    }
  return definitions as MergeFragments<Fragments>
}

export function registerOperations<
  const Definitions extends OperationDefinitions
>(
  definitions: Definitions,
  expectedHandler: OperationHandlerOwner
): {
  readonly [Kind in keyof Definitions]: Definitions[Kind] &
    Readonly<{ namespace: string; method: string }>
} {
  return Object.fromEntries(
    Object.entries(definitions).map(([kind, definition]) => {
      if (definition.key !== kind)
        throw new Error(`operation_key_mismatch:${kind}:${definition.key}`)
      if (definition.handler !== expectedHandler)
        throw new Error(
          `operation_handler_mismatch:${kind}:${definition.handler}:${expectedHandler}`
        )
      const namespace = operationNamespace(kind)
      const separator = kind.indexOf('.')
      return [
        kind,
        {
          ...definition,
          namespace,
          method: kind.slice(separator + 1)
        }
      ]
    })
  ) as {
    readonly [Kind in keyof Definitions]: Definitions[Kind] &
      Readonly<{ namespace: string; method: string }>
  }
}

export type OperationHandlers<Definitions extends OperationDefinitions> = {
  readonly [Kind in keyof Definitions]: (
    input: z.output<Definitions[Kind]['input']>
  ) => unknown
}

export type ContextualOperationHandlers<
  Definitions extends OperationDefinitions,
  Context
> = {
  readonly [Kind in keyof Definitions]: (
    context: Context,
    input: z.output<Definitions[Kind]['input']>
  ) => unknown
}

export function defineOperationHandlers<
  const Definitions extends OperationDefinitions,
  const Handlers extends OperationHandlers<Definitions>
>(owner: string, definitions: Definitions, handlers: Handlers): Handlers {
  assertExactOperationKeys(
    owner,
    Object.keys(definitions),
    Object.keys(handlers)
  )
  return handlers
}

export function defineContextualOperationHandlers<
  const Definitions extends OperationDefinitions,
  Context,
  const Handlers extends ContextualOperationHandlers<Definitions, Context> =
    ContextualOperationHandlers<Definitions, Context>
>(owner: string, definitions: Definitions, handlers: Handlers): Handlers {
  assertExactOperationKeys(
    owner,
    Object.keys(definitions),
    Object.keys(handlers)
  )
  return handlers
}

export function validatedOperationResult<Output extends z.ZodType>(
  definition: Readonly<{ output: Output }>,
  raw: unknown,
  afterValidation: (result: z.output<Output>) => void
): z.output<Output> {
  const result = definition.output.parse(raw)
  afterValidation(result)
  return result
}

export function composeOperationHandlers<
  const Definitions extends OperationDefinitions
>(
  owner: string,
  definitions: Definitions,
  ...fragments: readonly Readonly<Record<string, (input: never) => unknown>>[]
): OperationHandlers<Definitions> {
  const handlers: Record<string, (input: never) => unknown> = {}
  for (const fragment of fragments)
    for (const [kind, handler] of Object.entries(fragment)) {
      if (Object.hasOwn(handlers, kind))
        throw new Error(`duplicate_operation_handler:${kind}`)
      handlers[kind] = handler
    }
  assertExactOperationKeys(
    owner,
    Object.keys(definitions),
    Object.keys(handlers)
  )
  return handlers as OperationHandlers<Definitions>
}

export function operationKindsForRole(
  definitions: OperationDefinitions,
  role: WindowRole
): readonly string[] {
  return Object.entries(definitions)
    .filter(
      ([, definition]) =>
        definition.channel !== null && operationAllowsRole(definition, role)
    )
    .map(([kind]) => kind)
    .sort()
}

type OperationDefinitionsForRole<
  Definitions extends OperationDefinitions,
  Role extends WindowRole
> = {
  readonly [
    Kind in keyof Definitions as Definitions[Kind] extends Readonly<{
      roles: infer Roles extends readonly WindowRole[]
    }>
      ? Role extends Roles[number]
        ? Kind
        : never
      : never
  ]: Definitions[Kind]
}

export function operationDefinitionsForRole<
  const Definitions extends OperationDefinitions,
  const Role extends WindowRole
>(
  definitions: Definitions,
  role: Role
): OperationDefinitionsForRole<Definitions, Role> {
  return Object.fromEntries(
    Object.entries(definitions).filter(
      ([, definition]) =>
        definition.channel !== null && operationAllowsRole(definition, role)
    )
  ) as OperationDefinitionsForRole<Definitions, Role>
}

export function operationAllowsRole(
  definition: Readonly<{ roles: readonly WindowRole[] }>,
  role: WindowRole
): boolean {
  return definition.roles.includes(role)
}

export function assertExactOperationKeys(
  owner: string,
  expectedKinds: readonly string[],
  actualKinds: readonly string[]
): void {
  const expected = new Set(expectedKinds)
  const actual = new Set(actualKinds)
  const missing = [...expected].filter((kind) => !actual.has(kind)).sort()
  const extra = [...actual].filter((kind) => !expected.has(kind)).sort()
  if (missing.length === 0 && extra.length === 0) return
  throw new Error(
    `${owner}_operation_mismatch:missing=${missing.join(',')};extra=${extra.join(',')}`
  )
}

function operationNamespace(kind: string): string {
  const separator = kind.indexOf('.')
  if (separator < 1 || separator === kind.length - 1)
    throw new Error(`invalid_operation_kind:${kind}`)
  return kind.slice(0, separator)
}
