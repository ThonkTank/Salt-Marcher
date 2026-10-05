/** Minimal pack shape needed to read Dungeondraft object tag files. */
export interface ObjectTagPack {
  readonly metadata: { readonly id: string };
  readonly entries: readonly { readonly path: string }[];
  asset(path: string): Blob;
}

function taggedObjectPaths(text: string, packId: string): readonly string[] {
  const document: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (!document || typeof document !== "object" || Array.isArray(document))
    return [];
  const tags = (document as Record<string, unknown>).tags;
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return [];
  const colorable = (tags as Record<string, unknown>).Colorable;
  if (!Array.isArray(colorable)) return [];
  const prefix = `res://packs/${packId}/`;
  return colorable.flatMap((value: unknown) => {
    if (typeof value !== "string") return [];
    const path = value.startsWith(prefix) ? value.slice(prefix.length) : value;
    return /^textures\/objects\/.+\.png$/i.test(path) ? [path] : [];
  });
}

/** Returns paths relative to res://packs/<id>/, matching AssetDefinition.files.image. */
export async function discoverColorableObjectPaths(
  pack: ObjectTagPack,
): Promise<ReadonlySet<string>> {
  const prefix = `res://packs/${pack.metadata.id}/`;
  const paths = new Set<string>();
  for (const entry of pack.entries) {
    if (!entry.path.startsWith(prefix)) continue;
    const relative = entry.path.slice(prefix.length);
    if (!/^data\/.+\.dungeondraft_tags$/i.test(relative)) continue;
    const text = await pack.asset(relative).text();
    for (const path of taggedObjectPaths(text, pack.metadata.id))
      paths.add(path);
  }
  return paths;
}
