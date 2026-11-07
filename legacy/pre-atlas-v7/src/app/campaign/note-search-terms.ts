export function noteSearchTerms(search: string): string[] {
  return (search.trim().match(/"[^"]*"|\S+/gu) ?? [])
    .map((part) =>
      part.length > 1 && part.startsWith('"') && part.endsWith('"') ? part.slice(1, -1) : part,
    )
    .filter((part) => /[\p{L}\p{N}]/u.test(part));
}
