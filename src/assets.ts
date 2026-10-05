export interface BinarySource {
  readonly size: number;
  slice(start?: number, end?: number): Blob;
}

export interface PackEntry {
  readonly path: string;
  readonly offset: number;
  readonly size: number;
}

export interface PackMetadata {
  readonly id: string;
  readonly name: string;
  readonly author?: string;
  readonly version?: string;
  readonly allow_3rd_party_mapping_software_to_read?: boolean;
  readonly [key: string]: unknown;
}

export interface DungeondraftPack {
  readonly metadata: PackMetadata;
  readonly allowed: boolean;
  readonly entries: readonly PackEntry[];
  asset(path: string): Blob;
}

export type AssetKind =
  | "object"
  | "pattern"
  | "path"
  | "portal"
  | "light"
  | "terrain"
  | "wall"
  | "tileset"
  | "roof"
  | "cave"
  | "material";

export interface AssetDefinition {
  readonly id: string;
  readonly packId: string;
  readonly kind: AssetKind;
  readonly name: string;
  readonly files: Readonly<Record<string, string>>;
  readonly tintable?: boolean;
  readonly color?: string;
}

const decoder = new TextDecoder("utf-8", { fatal: true });

function fail(message: string): never {
  throw new Error("Asset-Paket: " + message);
}

function validRelative(path: string): boolean {
  return (
    !!path &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !/[\x00-\x1f]/.test(path) &&
    path.split("/").every((part) => !!part && part !== "." && part !== "..")
  );
}

function readNumber(view: DataView, offset: number): number {
  const value = view.getBigUint64(offset, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail("Ungültige Dateigrenze.");
  return Number(value);
}

/** Reads the PCK directory first. Payloads remain slices of the source until used. */
export async function readDungeondraftPack(
  source: BinarySource,
): Promise<DungeondraftPack> {
  if (!source || !Number.isSafeInteger(source.size) || source.size < 88)
    fail("Keine lesbare Datei.");
  let position = 0;
  const take = async (length: number): Promise<Uint8Array> => {
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      position + length > source.size
    )
      fail("Die Datei ist unvollständig.");
    const bytes = new Uint8Array(
      await source.slice(position, position + length).arrayBuffer(),
    );
    position += length;
    if (bytes.length !== length) fail("Die Datei ist unvollständig.");
    return bytes;
  };
  const header = new DataView((await take(88)).buffer);
  if (header.getUint32(0, true) !== 0x43504447)
    fail("Kein unterstützter Paketcontainer.");
  if (header.getUint32(4, true) !== 1)
    fail("Diese Paketversion wird nicht unterstützt.");
  const count = header.getUint32(84, true);
  if (count > Math.floor((source.size - 88) / 37))
    fail("Ungültige Dateiliste.");
  const entries = new Map<string, PackEntry>();
  for (let index = 0; index < count; index++) {
    const lengthBytes = await take(4),
      length = new DataView(
        lengthBytes.buffer,
        lengthBytes.byteOffset,
        lengthBytes.byteLength,
      ).getUint32(0, true);
    if (!length) fail("Ungültiger Dateipfad.");
    let path: string;
    try {
      path = decoder.decode(await take(length)).replace(/\0+$/, "");
    } catch {
      fail("Ungültiger Dateipfad.");
    }
    const relative = path.startsWith("res://") ? path.slice(6) : "";
    if (!path.startsWith("res://packs/") || !validRelative(relative) || entries.has(path))
      fail("Ungültiger oder doppelter Dateipfad.");
    const rowBytes = await take(32),
      row = new DataView(
        rowBytes.buffer,
        rowBytes.byteOffset,
        rowBytes.byteLength,
      ),
      offset = readNumber(row, 0),
      size = readNumber(row, 8);
    if (offset > source.size || size > source.size - offset)
      fail("Dateiinhalt liegt außerhalb des Pakets.");
    entries.set(path, { path, offset, size });
  }
  let occupiedUntil = position;
  for (const entry of [...entries.values()].sort((a, b) => a.offset - b.offset)) {
    if (entry.offset < occupiedUntil) fail("Überlappende Dateibereiche.");
    occupiedUntil = entry.offset + entry.size;
  }
  const absolute = (path: string): Blob => {
    const entry = entries.get(path);
    if (!entry) fail("Datei fehlt: " + path);
    return source.slice(entry.offset, entry.offset + entry.size);
  };
  const manifests = [...entries.keys()].filter((path) =>
    /^res:\/\/packs\/[^/]+\.json$/.test(path),
  );
  if (manifests.length !== 1) fail("Eindeutige Paketbeschreibung fehlt.");
  let metadata: PackMetadata;
  try {
    metadata = JSON.parse(await absolute(manifests[0]!).text()) as PackMetadata;
  } catch {
    fail("Ungültige Paketbeschreibung.");
  }
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    typeof metadata.id !== "string" ||
    !metadata.id ||
    typeof metadata.name !== "string" ||
    !metadata.name.trim() ||
    manifests[0] !== "res://packs/" + metadata.id + ".json"
  )
    fail("Ungültige Paketidentität.");
  const prefix = "res://packs/" + metadata.id + "/";
  if (
    [...entries.keys()].some(
      (path) => path !== manifests[0] && !path.startsWith(prefix),
    )
  )
    fail("Dateien gehören zu einem anderen Paket.");
  return {
    metadata,
    allowed: metadata.allow_3rd_party_mapping_software_to_read === true,
    entries: [...entries.values()],
    asset(path: string): Blob {
      if (!validRelative(path)) fail("Ungültiger Assetpfad.");
      return absolute(prefix + path);
    },
  };
}

function assetId(packId: string, kind: AssetKind, path: string): string {
  return ["pack", packId, kind, path].map(encodeURIComponent).join(":");
}

function displayName(path: string): string {
  return path.split("/").at(-1)!.replace(/\.[^.]+$/, "");
}

function parseObject(text: string, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(label + " enthält kein gültiges JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(label + " muss ein Objekt sein.");
  return value as Record<string, unknown>;
}

function imagePath(value: unknown, folder: string, label: string): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("textures/" + folder + "/") ||
    !/\.png$/i.test(value) ||
    !validRelative(value)
  )
    throw new Error(label + " verweist nicht auf ein gültiges PNG.");
  return value;
}

/** Builds lightweight metadata only. PNG bytes are not decoded or copied. */
export async function discoverPackAssets(
  pack: DungeondraftPack,
): Promise<readonly AssetDefinition[]> {
  const prefix = "res://packs/" + pack.metadata.id + "/",
    relativeEntries = pack.entries
      .filter((entry) => entry.path.startsWith(prefix))
      .map((entry) => ({ ...entry, relative: entry.path.slice(prefix.length) })),
    result: AssetDefinition[] = [];
  const simple: readonly [AssetKind, RegExp][] = [
    ["object", /^textures\/objects\/.+\.png$/i],
    ["pattern", /^textures\/patterns\/(?:normal|colorable)\/.+\.png$/i],
    ["path", /^textures\/paths\/.+\.png$/i],
    ["portal", /^textures\/portals\/.+\.png$/i],
    ["light", /^textures\/lights\/.+\.png$/i],
    ["terrain", /^textures\/terrain\/.+\.png$/i],
  ];
  for (const entry of relativeEntries)
    for (const [kind, pattern] of simple)
      if (pattern.test(entry.relative)) {
        result.push({
          id: assetId(pack.metadata.id, kind, entry.relative),
          packId: pack.metadata.id,
          kind,
          name: displayName(entry.relative),
          files: { image: entry.relative },
          ...(kind === "pattern"
            ? { tintable: entry.relative.includes("/colorable/") }
            : {}),
        });
        break;
      }
  for (const entry of relativeEntries.filter((entry) =>
    /^data\/walls\/.+\.dungeondraft_wall$/i.test(entry.relative),
  )) {
    const data = parseObject(await pack.asset(entry.relative).text(), "Wandbeschreibung"),
      image = imagePath(data.path, "walls", "Wandbeschreibung"),
      end = image.replace(/\.png$/i, "_end.png");
    pack.asset(image);
    pack.asset(end);
    if (typeof data.color !== "string" || !/^[0-9a-f]{6}$/i.test(data.color))
      throw new Error("Wandbeschreibung benötigt eine sechsstellige Farbe.");
    result.push({
      id: assetId(pack.metadata.id, "wall", entry.relative),
      packId: pack.metadata.id,
      kind: "wall",
      name: displayName(entry.relative),
      files: { image, end },
      color: "#" + data.color.toLowerCase(),
    });
  }
  for (const entry of relativeEntries.filter((entry) =>
    /^data\/tilesets\/.+\.dungeondraft_tileset$/i.test(entry.relative),
  )) {
    const data = parseObject(
        await pack.asset(entry.relative).text(),
        "Bodenbeschreibung",
      ),
      image = imagePath(data.path, "tilesets", "Bodenbeschreibung");
    pack.asset(image);
    if (typeof data.name !== "string" || !data.name.trim())
      throw new Error("Name des Gebäudebodens fehlt.");
    result.push({
      id: assetId(pack.metadata.id, "tileset", entry.relative),
      packId: pack.metadata.id,
      kind: "tileset",
      name: data.name,
      files: { image },
      tintable: data.type === "custom_color",
      ...(typeof data.color === "string" && /^[0-9a-f]{6}$/i.test(data.color)
        ? { color: "#" + data.color.toLowerCase() }
        : {}),
    });
  }
  const grouped = (
    kind: "roof" | "cave" | "material",
    pattern: RegExp,
    required: readonly string[],
  ) => {
    const groups = new Map<string, { name: string; files: Record<string, string> }>();
    for (const entry of relativeEntries) {
      const match = pattern.exec(entry.relative);
      if (!match) continue;
      const groupPath = match[1]!,
        part = match[2]!.toLowerCase(),
        current = groups.get(groupPath) ?? {
          name: displayName(groupPath),
          files: {},
        };
      if (current.files[part]) throw new Error("Doppelter Assetbestandteil: " + entry.relative);
      current.files[part] = entry.relative;
      groups.set(groupPath, current);
    }
    for (const [groupPath, group] of groups) {
      for (const part of required)
        if (!group.files[part])
          throw new Error(group.name + ": Bestandteil " + part + " fehlt.");
      result.push({
        id: assetId(pack.metadata.id, kind, groupPath),
        packId: pack.metadata.id,
        kind,
        name: group.name,
        files: group.files,
        ...(kind === "cave" ? { tintable: group.name === "colorable" } : {}),
      });
    }
  };
  grouped(
    "roof",
    /^(textures\/roofs\/.+)\/(tiles|edge|hip|ridge)\.png$/i,
    ["tiles", "edge", "hip", "ridge"],
  );
  grouped(
    "cave",
    /^(textures\/caves\/.+)\/(floor|wall)\.png$/i,
    ["floor", "wall"],
  );
  grouped(
    "material",
    /^(textures\/materials\/.+?)_(tile|border)\.png$/i,
    ["tile", "border"],
  );
  return result.sort((a, b) =>
    a.kind === b.kind
      ? a.name.localeCompare(b.name, "de")
      : a.kind.localeCompare(b.kind, "en"),
  );
}

/** Owns only temporary URLs. Closing the library releases every decoded source. */
export class PackAssetLibrary {
  private packs = new Map<string, DungeondraftPack>();
  private definitions = new Map<string, AssetDefinition>();
  private urls = new Map<string, string>();

  async add(source: BinarySource): Promise<readonly AssetDefinition[]> {
    const pack = await readDungeondraftPack(source);
    if (!pack.allowed)
      throw new Error(
        "Dieses Paket ist nicht für andere Kartenprogramme freigegeben: " +
          pack.metadata.name,
      );
    const assets = await discoverPackAssets(pack);
    if (this.packs.has(pack.metadata.id))
      throw new Error("Paket bereits geladen: " + pack.metadata.name);
    this.packs.set(pack.metadata.id, pack);
    for (const asset of assets) this.definitions.set(asset.id, asset);
    return assets;
  }

  list(kind?: AssetKind, search = ""): readonly AssetDefinition[] {
    const query = search.trim().toLocaleLowerCase("de");
    return [...this.definitions.values()].filter(
      (asset) =>
        (!kind || asset.kind === kind) &&
        (!query || asset.name.toLocaleLowerCase("de").includes(query)),
    );
  }

  has(id: string): boolean {
    return this.definitions.has(id);
  }

  blob(id: string, part = "image"): Blob {
    const definition = this.definitions.get(id);
    if (!definition) throw new Error("Asset nicht gefunden: " + id);
    const path = definition.files[part];
    if (!path) throw new Error("Assetbestandteil fehlt: " + part);
    return this.packs.get(definition.packId)!.asset(path);
  }

  url(id: string, part = "image"): string {
    const key = id + "\0" + part;
    let url = this.urls.get(key);
    if (!url) {
      url = URL.createObjectURL(this.blob(id, part));
      this.urls.set(key, url);
    }
    return url;
  }

  close(): void {
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
    this.definitions.clear();
    this.packs.clear();
  }
}

export interface CatalogRecord {
  readonly metadata: PackMetadata;
  readonly hash: string;
  readonly size: number;
  readonly enabled: boolean;
  readonly assetCount: number;
}

export interface CatalogData {
  readonly version: 1;
  readonly builtIns: boolean;
  readonly packs: readonly CatalogRecord[];
}

export interface AssetCatalogStore {
  readCatalog(): Promise<string | null>;
  writeCatalog(text: string): Promise<void>;
  writePackage(hash: string, source: BinarySource): Promise<void>;
  readPackage(hash: string): Promise<BinarySource>;
  removePackage(hash: string): Promise<void>;
}

const emptyCatalog = (): CatalogData => ({
  version: 1,
  builtIns: true,
  packs: [],
});

function validateCatalog(value: unknown): CatalogData {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Ungültiger Assetkatalog.");
  const data = value as Partial<CatalogData>;
  if (
    data.version !== 1 ||
    typeof data.builtIns !== "boolean" ||
    !Array.isArray(data.packs)
  )
    throw new Error("Ungültiger Assetkatalog.");
  const ids = new Set<string>();
  for (const record of data.packs) {
    if (
      !record ||
      !record.metadata ||
      typeof record.metadata.id !== "string" ||
      !record.metadata.id ||
      typeof record.metadata.name !== "string" ||
      !record.metadata.name.trim() ||
      ids.has(record.metadata.id) ||
      !/^[0-9a-f]{64}$/.test(record.hash) ||
      !Number.isSafeInteger(record.size) ||
      record.size < 0 ||
      !Number.isSafeInteger(record.assetCount) ||
      record.assetCount < 0 ||
      typeof record.enabled !== "boolean"
    )
      throw new Error("Ungültiger Assetkatalog.");
    ids.add(record.metadata.id);
  }
  return structuredClone(data as CatalogData);
}

async function sha256(source: BinarySource): Promise<string> {
  const bytes = await source.slice(0, source.size).arrayBuffer(),
    digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Serializes catalog mutations; packages are immutable and named by their digest. */
export class AssetCatalog {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private store: AssetCatalogStore) {}

  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  async read(): Promise<CatalogData> {
    const text = await this.store.readCatalog();
    if (text === null) return emptyCatalog();
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error("Ungültiger Assetkatalog.");
    }
    return validateCatalog(value);
  }

  add(sources: readonly BinarySource[]): Promise<readonly CatalogRecord[]> {
    return this.exclusive(async () => {
      if (!sources.length) return [];
      const prepared: {
        source: BinarySource;
        record: CatalogRecord;
      }[] = [];
      const ids = new Set<string>();
      for (const source of sources) {
        const pack = await readDungeondraftPack(source);
        if (!pack.allowed)
          throw new Error(
            "Dieses Paket ist nicht für andere Kartenprogramme freigegeben: " +
              pack.metadata.name,
          );
        if (ids.has(pack.metadata.id))
          throw new Error("Paket doppelt ausgewählt: " + pack.metadata.name);
        ids.add(pack.metadata.id);
        const assets = await discoverPackAssets(pack);
        if (!assets.length)
          throw new Error("Paket enthält keine unterstützten Assets: " + pack.metadata.name);
        prepared.push({
          source,
          record: {
            metadata: pack.metadata,
            hash: await sha256(source),
            size: source.size,
            enabled: true,
            assetCount: assets.length,
          },
        });
      }
      const current = await this.read(),
        packs = [...current.packs],
        retired = new Set<string>();
      for (const item of prepared) {
        await this.store.writePackage(item.record.hash, item.source);
        const index = packs.findIndex(
          (record) => record.metadata.id === item.record.metadata.id,
        );
        if (index >= 0) {
          const previous = packs[index]!;
          packs[index] = { ...item.record, enabled: previous.enabled };
          if (previous.hash !== item.record.hash) retired.add(previous.hash);
        } else packs.push(item.record);
      }
      await this.store.writeCatalog(
        JSON.stringify({ ...current, packs } satisfies CatalogData, null, 2) + "\n",
      );
      for (const hash of retired)
        if (!packs.some((record) => record.hash === hash))
          await this.store.removePackage(hash);
      return prepared.map((item) => item.record);
    });
  }

  setEnabled(id: string, enabled: boolean): Promise<void> {
    return this.exclusive(async () => {
      const current = await this.read(),
        record = current.packs.find((candidate) => candidate.metadata.id === id);
      if (!record) throw new Error("Assetpaket nicht gefunden.");
      const packs = current.packs.map((candidate) =>
        candidate === record ? { ...candidate, enabled } : candidate,
      );
      await this.store.writeCatalog(
        JSON.stringify({ ...current, packs } satisfies CatalogData, null, 2) + "\n",
      );
    });
  }

  setBuiltIns(builtIns: boolean): Promise<void> {
    return this.exclusive(async () => {
      const current = await this.read();
      await this.store.writeCatalog(
        JSON.stringify({ ...current, builtIns } satisfies CatalogData, null, 2) +
          "\n",
      );
    });
  }

  remove(id: string): Promise<void> {
    return this.exclusive(async () => {
      const current = await this.read(),
        record = current.packs.find((candidate) => candidate.metadata.id === id);
      if (!record) return;
      const packs = current.packs.filter((candidate) => candidate !== record);
      await this.store.writeCatalog(
        JSON.stringify({ ...current, packs } satisfies CatalogData, null, 2) + "\n",
      );
      if (!packs.some((candidate) => candidate.hash === record.hash))
        await this.store.removePackage(record.hash);
    });
  }

  async loadEnabled(): Promise<PackAssetLibrary> {
    const current = await this.read();
    return this.load(current.packs.filter((record) => record.enabled).map((record) => record.metadata.id));
  }

  loadAll(): Promise<PackAssetLibrary> {
    return this.load();
  }

  private async load(ids?: readonly string[]): Promise<PackAssetLibrary> {
    const library = new PackAssetLibrary(),
      current = await this.read(),
      selected = ids ? new Set(ids) : undefined;
    try {
      for (const record of current.packs)
        if (!selected || selected.has(record.metadata.id)) {
          const source = await this.store.readPackage(record.hash);
          if (source.size !== record.size)
            throw new Error(
              "Gespeichertes Assetpaket ist unvollständig: " + record.metadata.name,
            );
          await library.add(source);
        }
      return library;
    } catch (error) {
      library.close();
      throw error;
    }
  }
}
