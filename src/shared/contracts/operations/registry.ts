import { z } from 'zod'

export type OperationMode = 'read' | 'write'
export type WindowRole = 'gm' | 'passive' | 'qualification'

export interface OperationDefinition<
  Input extends z.ZodType = z.ZodType,
  Output extends z.ZodType = z.ZodType
> {
  readonly channel: string | null
  readonly input: Input
  readonly output: Output
  readonly mode: OperationMode
  readonly roles: readonly WindowRole[]
  readonly deadlineMs: number
  readonly namespace?: string
  readonly method?: string
}

export type OperationDefinitions = Readonly<Record<string, OperationDefinition>>

export const none = z.undefined()

export const read = <Input extends z.ZodType, Output extends z.ZodType>(
  channel: string | null,
  input: Input,
  output: Output,
  roles: readonly WindowRole[] = ['gm']
): OperationDefinition<Input, Output> => ({
  channel,
  input,
  output,
  mode: 'read',
  roles,
  deadlineMs: 10_000
})

export const write = <Input extends z.ZodType, Output extends z.ZodType>(
  channel: string | null,
  input: Input,
  output: Output,
  roles: readonly WindowRole[] = ['gm']
): OperationDefinition<Input, Output> => ({
  channel,
  input,
  output,
  mode: 'write',
  roles,
  deadlineMs: 10_000
})

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
  definitions: Definitions
): {
  readonly [Kind in keyof Definitions]: Definitions[Kind] &
    Readonly<{ namespace: string; method: string }>
} {
  return Object.fromEntries(
    Object.entries(definitions).map(([kind, definition]) => {
      const separator = kind.indexOf('.')
      if (separator < 1 || separator === kind.length - 1)
        throw new Error(`invalid_operation_kind:${kind}`)
      return [
        kind,
        {
          ...definition,
          namespace: kind.slice(0, separator),
          method: kind.slice(separator + 1)
        }
      ]
    })
  ) as {
    readonly [Kind in keyof Definitions]: Definitions[Kind] &
      Readonly<{ namespace: string; method: string }>
  }
}

export function operationKindsForRole(
  definitions: OperationDefinitions,
  role: WindowRole
): readonly string[] {
  return Object.entries(definitions)
    .filter(
      ([, definition]) =>
        definition.channel !== null && definition.roles.includes(role)
    )
    .map(([kind]) => kind)
    .sort()
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
