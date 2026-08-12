import type { z } from 'zod'
import type { capabilityEvents } from './events.js'
import type { coreOperations, mainOperations } from './operations.js'

type AnyDefinition = Readonly<{
  channel: string | null
  input: z.ZodType
  output: z.ZodType
}>

type AnyEventDefinition = Readonly<{ payload: z.ZodType }>

type OperationRegistry = typeof coreOperations & typeof mainOperations

type Namespace<Kind> = Kind extends `${infer Value}.${string}` ? Value : never
type Method<Kind> = Kind extends `${string}.${infer Value}` ? Value : never
type PublicNamespace<Value> = Value extends 'campaign' ? 'campaigns' : Value

type OperationFunction<Definition extends AnyDefinition> = [
  z.output<Definition['input']>
] extends [undefined]
  ? () => Promise<z.output<Definition['output']>>
  : (
      input: z.output<Definition['input']>
    ) => Promise<z.output<Definition['output']>>

type PublicOperationKind<
  Registry extends Readonly<Record<string, AnyDefinition>>
> = Exclude<keyof Registry, 'core.shutdown'>

type NamespaceOperations<
  Registry extends Readonly<Record<string, AnyDefinition>>,
  Name extends string
> = {
  [
    Kind in keyof Registry as Kind extends 'core.shutdown'
      ? never
      : Kind extends string
        ? Namespace<Kind> extends Name
          ? Method<Kind>
          : never
        : never
  ]: Registry[Kind] extends AnyDefinition
    ? OperationFunction<Registry[Kind]>
    : never
}

type DerivedOperationApi<
  Registry extends Readonly<Record<string, AnyDefinition>>
> = {
  [
    Name in Namespace<PublicOperationKind<Registry>> &
      string as PublicNamespace<Name>
  ]: NamespaceOperations<Registry, Name>
}

type EventFunction<Definition extends AnyEventDefinition> = (
  listener: (notice: z.output<Definition['payload']>) => void
) => () => void

type NamespaceEvents<
  Registry extends Readonly<Record<string, AnyEventDefinition>>,
  Name extends string
> = {
  [
    Kind in keyof Registry as Kind extends string
      ? Namespace<Kind> extends Name
        ? Method<Kind>
        : never
      : never
  ]: Registry[Kind] extends AnyEventDefinition
    ? EventFunction<Registry[Kind]>
    : never
}

type DerivedEventApi<
  Registry extends Readonly<Record<string, AnyEventDefinition>>
> = {
  [
    Name in Namespace<keyof Registry> & string as PublicNamespace<Name>
  ]: NamespaceEvents<Registry, Name>
}

type MergeNamespaces<Operations, Events> = {
  [Name in keyof Operations | keyof Events]: (Name extends keyof Operations
    ? Operations[Name]
    : object) &
    (Name extends keyof Events ? Events[Name] : object)
}

type RegistryApi = MergeNamespaces<
  DerivedOperationApi<OperationRegistry>,
  DerivedEventApi<typeof capabilityEvents>
>

export type SaltMarcherApi = Omit<RegistryApi, 'runtime'> &
  Readonly<{
    runtime: RegistryApi['runtime'] &
      Readonly<{
        readOnly: boolean
        e2e: boolean
      }>
  }>

export type CampaignReadCapability = Pick<SaltMarcherApi['campaigns'], 'list'>
export type CampaignCapability = SaltMarcherApi['campaigns']
export type GeneratorPresetCapability = SaltMarcherApi['generatorPresets']
