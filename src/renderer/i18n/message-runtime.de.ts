type PlaceholderNames<Value extends string> =
  Value extends `${string}{${infer Name}}${infer Rest}`
    ? Name | PlaceholderNames<Rest>
    : never

type PlainKey<Dictionary extends Readonly<Record<string, string>>> = {
  [Key in keyof Dictionary & string]: PlaceholderNames<
    Dictionary[Key]
  > extends never
    ? Key
    : never
}[keyof Dictionary & string]

type ParameterizedKey<Dictionary extends Readonly<Record<string, string>>> =
  Exclude<keyof Dictionary & string, PlainKey<Dictionary>>

/** Creates a feature-local formatter without retaining any other dictionary. */
export function createMessageFormatter<
  const Dictionary extends Readonly<Record<string, string>>
>(messages: Dictionary) {
  const message = (
    key: PlainKey<Dictionary>,
    pseudo = pseudoLocaleEnabled()
  ): string => {
    const value = messages[key]!
    return pseudo ? pseudoExpand(value) : value
  }
  const formatMessage = <Key extends ParameterizedKey<Dictionary>>(
    key: Key,
    parameters: Readonly<
      Record<PlaceholderNames<Dictionary[Key]>, string | number>
    >,
    pseudo = pseudoLocaleEnabled()
  ): string => {
    const provided = parameters as Readonly<Record<string, string | number>>
    const value = messages[key]!.replace(
      /\{([a-zA-Z][a-zA-Z0-9]*)\}/g,
      (placeholder, name: string) =>
        Object.hasOwn(provided, name)
          ? String(provided[name])
          : missingParameter(key, placeholder)
    )
    return pseudo ? pseudoExpand(value) : value
  }
  return { message, formatMessage }
}

function missingParameter(key: PropertyKey, placeholder: string): never {
  throw new Error(`Missing ${placeholder} for message ${String(key)}`)
}

export function pseudoExpand(value: string): string {
  const expanded = value.replace(/[aeiouäöüAEIOUÄÖÜ]/g, '$&$&')
  const minimum = Math.ceil(value.length * 1.4)
  return `⟦${expanded.padEnd(Math.max(expanded.length, minimum), '·')}⟧`
}

function pseudoLocaleEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('locale') === 'pseudo'
}
