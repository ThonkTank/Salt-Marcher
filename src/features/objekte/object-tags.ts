import type { AssetDefinition } from "../../assets";

/** Dungeondraft's tag file shape: a tag contains object paths; a set contains tags. */
export interface ObjectTagDocument {
  readonly tags: Readonly<Record<string, readonly string[]>>;
  readonly sets: Readonly<Record<string, readonly string[]>>;
}

export const emptyObjectTags = (): ObjectTagDocument => ({ tags: {}, sets: {} });

function validName(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() &&
    value === value.trim() && !/[\x00-\x1f]/.test(value);
}

export function validObjectPath(value: unknown): value is string {
  if (typeof value !== "string" || !value.endsWith(".png") ||
      value.includes("\\") || /[\x00-\x1f]/.test(value)) return false;
  const relative = value.startsWith("res://textures/objects/")
    ? value.slice("res://textures/objects/".length)
    : /^res:\/\/packs\/[^/]+\/textures\/objects\//.test(value)
      ? value.replace(/^res:\/\/packs\/[^/]+\/textures\/objects\//, "") : "";
  return !!relative && relative.split("/").every((part) =>
    !!part && part !== "." && part !== "..",
  );
}

function parseLists(value: unknown, label: string,
  validMember: (value: unknown) => value is string): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Objekt-Tags: ${label} fehlt.`);
  const result: Record<string, string[]> = Object.create(null);
  for (const [name, members] of Object.entries(value)) {
    if (!validName(name) || !Array.isArray(members) ||
        !members.every(validMember) || new Set(members).size !== members.length)
      throw new Error(`Objekt-Tags: Ungültiger ${label}-Eintrag.`);
    result[name] = [...members];
  }
  return result;
}

export function parseObjectTags(text: string): ObjectTagDocument {
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new Error("Objekt-Tags: Ungültiges JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Objekt-Tags: Ungültiges Dokument.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== "sets,tags")
    throw new Error("Objekt-Tags: Felder fehlen oder sind unbekannt.");
  const tags = parseLists(record.tags, "Tag", validObjectPath);
  const sets = parseLists(record.sets, "Set", validName);
  for (const members of Object.values(sets))
    if (members.some((name) => !Object.hasOwn(tags, name)))
      throw new Error("Objekt-Tags: Set verweist auf fehlenden Tag.");
  return { tags, sets };
}

/** Pack tag files may use paths relative to their own res://packs/<id>/ root. */
export function parsePackageObjectTags(text: string, packId: string): ObjectTagDocument {
  if (!packId || packId.includes("/") || packId.includes("\\"))
    throw new Error("Objekt-Tags: Ungültige Paketkennung.");
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new Error("Objekt-Tags: Ungültiges Paket-JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Objekt-Tags: Ungültiges Paketdokument.");
  const record = value as Record<string, unknown>;
  if (!record.tags || typeof record.tags !== "object" || Array.isArray(record.tags))
    throw new Error("Objekt-Tags: Pakettags fehlen.");
  const tags = Object.fromEntries(Object.entries(record.tags).map(([tag, paths]) => {
    if (!Array.isArray(paths)) throw new Error("Objekt-Tags: Paketpfade fehlen.");
    return [tag, paths.map((path: unknown) => {
      if (typeof path !== "string") throw new Error("Objekt-Tags: Ungültiger Paketpfad.");
      return path.startsWith("res://") ? path : `res://packs/${packId}/${path}`;
    })];
  }));
  return parseObjectTags(JSON.stringify({ tags, sets: record.sets ?? {} }));
}

export function mergeObjectTags(...documents: readonly ObjectTagDocument[]): ObjectTagDocument {
  const tags: Record<string, string[]> = Object.create(null);
  const sets: Record<string, string[]> = Object.create(null);
  for (const document of documents) {
    for (const [name, members] of Object.entries(document.tags))
      tags[name] = [...new Set([...(tags[name] ?? []), ...members])];
    for (const [name, members] of Object.entries(document.sets))
      sets[name] = [...new Set([...(sets[name] ?? []), ...members])];
  }
  return { tags, sets };
}

export function serializeObjectTags(document: ObjectTagDocument): string {
  const normalized = parseObjectTags(JSON.stringify(document));
  const sorted = (record: Readonly<Record<string, readonly string[]>>) =>
    Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b, "en")));
  return JSON.stringify({ tags: sorted(normalized.tags), sets: sorted(normalized.sets) },
    null, "\t") + "\n";
}

export function copyObjectTags(document: ObjectTagDocument): ObjectTagDocument {
  return parseObjectTags(JSON.stringify(document));
}

export function addObjectTag(document: ObjectTagDocument, name: string): ObjectTagDocument {
  if (!validName(name) || Object.hasOwn(document.tags, name))
    throw new Error("Tagname fehlt oder ist bereits vorhanden.");
  return { tags: { ...document.tags, [name]: [] }, sets: { ...document.sets } };
}

export function removeObjectTag(document: ObjectTagDocument, name: string): ObjectTagDocument {
  if (!Object.hasOwn(document.tags, name)) throw new Error("Tag fehlt.");
  const tags = { ...document.tags };
  delete tags[name];
  const sets = Object.fromEntries(Object.entries(document.sets).map(
    ([set, members]) => [set, members.filter((member) => member !== name)],
  ));
  return { tags, sets };
}

export function addObjectSet(document: ObjectTagDocument, name: string): ObjectTagDocument {
  if (!validName(name) || Object.hasOwn(document.sets, name))
    throw new Error("Setname fehlt oder ist bereits vorhanden.");
  return { tags: { ...document.tags }, sets: { ...document.sets, [name]: [] } };
}

export function removeObjectSet(document: ObjectTagDocument, name: string): ObjectTagDocument {
  if (!Object.hasOwn(document.sets, name)) throw new Error("Set fehlt.");
  const sets = { ...document.sets };
  delete sets[name];
  return { tags: { ...document.tags }, sets };
}

function membership(members: readonly string[], value: string, enabled: boolean): string[] {
  return enabled ? members.includes(value) ? [...members] : [...members, value]
    : members.filter((member) => member !== value);
}

export function assignObjectTag(document: ObjectTagDocument, tag: string,
  path: string, enabled: boolean): ObjectTagDocument {
  if (!Object.hasOwn(document.tags, tag) || !validObjectPath(path))
    throw new Error("Tag oder Objektpfad fehlt.");
  return { tags: { ...document.tags,
    [tag]: membership(document.tags[tag]!, path, enabled) },
    sets: { ...document.sets } };
}

export function assignTagToSet(document: ObjectTagDocument, set: string,
  tag: string, enabled: boolean): ObjectTagDocument {
  if (!Object.hasOwn(document.sets, set) || !Object.hasOwn(document.tags, tag))
    throw new Error("Set oder Tag fehlt.");
  return { tags: { ...document.tags }, sets: { ...document.sets,
    [set]: membership(document.sets[set]!, tag, enabled) } };
}

export function objectPath(asset: AssetDefinition): string | undefined {
  if (asset.kind !== "object") return undefined;
  const path = asset.files.image;
  if (!path) return undefined;
  const source = path.startsWith("res://") ? path
    : `res://packs/${asset.packId}/${path}`;
  return validObjectPath(source) ? source : undefined;
}
