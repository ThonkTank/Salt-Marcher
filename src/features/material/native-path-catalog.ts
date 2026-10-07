import type { AssetDefinition, BinarySource } from "../../assets";

/** The locally inspected Dungeondraft 1.2.0.1 Linux resource archive. */
export const NATIVE_PATH_PCK_SHA256 =
  "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60";
export const NATIVE_PATH_PACK_ID = "dungeondraft-builtin-1.2.0.1";

/** Native paths use a dedicated namespace and must not change package-path rendering. */
export function isNativePathAssetId(id: string | undefined): boolean {
  return id?.startsWith(`pack:${NATIVE_PATH_PACK_ID}:path:`) ?? false;
}
export function isNativeFloorAssetId(id: string | undefined): boolean {
  return id?.startsWith(`pack:${NATIVE_PATH_PACK_ID}:tileset:`) ?? false;
}
export function isNativeWallAssetId(id: string | undefined): boolean {
  return id?.startsWith(`pack:${NATIVE_PATH_PACK_ID}:wall:`) ?? false;
}

export interface NativePathTexture {
  readonly asset: AssetDefinition;
  readonly sourcePath: string;
  readonly width: number;
  readonly height: number;
}

export interface NativePathCatalog {
  readonly textures: readonly NativePathTexture[];
  readonly floors: readonly AssetDefinition[];
  readonly walls: readonly AssetDefinition[];
  /** Returns a directly displayable WebP slice; undefined for foreign IDs. */
  image(assetId: string): Blob | undefined;
}

interface DirectoryEntry {
  readonly offset: number;
  readonly size: number;
}

const decoder = new TextDecoder("utf-8", { fatal: true });
const PATH_IMPORT = /^res:\/\/textures\/paths\/([^/]+)\.png\.import$/;
const REMAP_PATH = /^path="(res:\/\/\.import\/[^"\r\n]+\.stex)"\s*$/gm;
/** The order stored in a new Dungeondraft 1.2.0.1 map's tiles.lookup. */
const FLOOR_ORDER = [
  "tileset_wood_vertical", "tileset_stone", "tileset_brick_worn",
  "tileset_diamond", "tileset_brick_running", "tileset_carpet",
  "tileset_cut_stone", "tileset_cobble", "tileset_concrete_large",
  "tileset_concrete_slab", "tileset_straw", "tileset_plank_45",
  "tileset_concrete", "tileset_ornate", "tileset_brick_basketweave",
  "tileset_cave", "tileset_roman_worn", "tileset_diamond_2",
  "tileset_wood_interlaced", "tileset_herringbone", "tileset_sewers",
  "tileset_wood_damaged", "tileset_roman_tiles", "tileset_worn_cobble",
] as const;
const WALL_ORDER = [
  "battlements", "cobble", "concrete", "stone", "stone_09",
  "stone_12", "wood", "wood_02", "wood_03", "wood_04",
] as const;

function invalid(detail: string): never {
  throw new Error("Dungeondraft-Pfadkatalog: " + detail);
}

function number64(view: DataView, offset: number): number {
  const value = view.getBigUint64(offset, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER))
    invalid("Dateigrenze ist zu groß.");
  return Number(value);
}

async function readExact(
  source: BinarySource,
  from: number,
  length: number,
): Promise<Uint8Array> {
  if (
    !Number.isSafeInteger(from) ||
    !Number.isSafeInteger(length) ||
    from < 0 ||
    length < 0 ||
    from > source.size ||
    length > source.size - from
  )
    invalid("Datei ist unvollständig.");
  const bytes = new Uint8Array(
    await source.slice(from, from + length).arrayBuffer(),
  );
  if (bytes.length !== length) invalid("Datei ist unvollständig.");
  return bytes;
}

async function readDirectory(
  source: BinarySource,
): Promise<Map<string, DirectoryEntry>> {
  if (!source || !Number.isSafeInteger(source.size) || source.size < 88)
    invalid("Keine lesbare PCK-Datei.");
  const header = new DataView((await readExact(source, 0, 88)).buffer);
  if (
    header.getUint32(0, true) !== 0x43504447 ||
    header.getUint32(4, true) !== 1
  )
    invalid("Nicht unterstütztes PCK-Format.");
  const count = header.getUint32(84, true);
  if (count > Math.floor((source.size - 88) / 37))
    invalid("Ungültige Dateiliste.");
  let position = 88;
  const entries = new Map<string, DirectoryEntry>();
  for (let index = 0; index < count; index++) {
    const lengthBytes = await readExact(source, position, 4);
    const length = new DataView(lengthBytes.buffer).getUint32(0, true);
    position += 4;
    if (length < 2 || length > 4096) invalid("Ungültiger Dateipfad.");
    const row = await readExact(source, position, length + 32);
    position += row.length;
    const firstZero = row.subarray(0, length).indexOf(0);
    const terminator = firstZero < 0 ? length : firstZero;
    if (
      terminator < 1 ||
      row.subarray(terminator, length).some((byte) => byte !== 0)
    )
      invalid("Ungültiger Dateipfad.");
    let path: string;
    try {
      path = decoder.decode(row.subarray(0, terminator));
    } catch {
      invalid("Ungültiger Dateipfad.");
    }
    const relative = path.slice(6);
    if (
      !path.startsWith("res://") ||
      !relative ||
      relative
        .split("/")
        .some((part) => !part || part === "." || part === "..") ||
      path.includes("\\") ||
      entries.has(path)
    )
      invalid("Ungültiger oder doppelter Dateipfad.");
    const data = new DataView(row.buffer, row.byteOffset + length, 32);
    const offset = number64(data, 0),
      size = number64(data, 8);
    if (offset > source.size || size > source.size - offset)
      invalid("Dateiinhalt liegt außerhalb des Pakets.");
    entries.set(path, { offset, size });
  }
  let occupiedUntil = position;
  for (const entry of [...entries.values()].sort(
    (a, b) => a.offset - b.offset,
  )) {
    if (entry.offset < occupiedUntil) invalid("Überlappende Dateibereiche.");
    occupiedUntil = entry.offset + entry.size;
  }
  return entries;
}

function nativePathId(sourcePath: string): string {
  return ["pack", NATIVE_PATH_PACK_ID, "path", sourcePath]
    .map(encodeURIComponent)
    .join(":");
}
export function nativeDesignId(kind: "tileset" | "wall", sourcePath: string): string {
  return ["pack", NATIVE_PATH_PACK_ID, kind, sourcePath]
    .map(encodeURIComponent).join(":");
}

/** Reads metadata and texture headers only. Image bytes remain slices of source. */
export async function readNativePathCatalog(
  source: BinarySource,
): Promise<NativePathCatalog> {
  const entries = await readDirectory(source);
  const textures: NativePathTexture[] = [];
  const floors: AssetDefinition[] = [];
  const walls: AssetDefinition[] = [];
  const images = new Map<string, DirectoryEntry>();
  const imageDetails = async (sourcePath: string, id: string) => {
    const metadata = entries.get(sourcePath + ".import");
    if (!metadata || metadata.size > 65_536)
      invalid("Bildmetadaten fehlen: " + sourcePath);
    const text = decoder.decode(await readExact(source, metadata.offset, metadata.size));
    const remaps = [...text.matchAll(REMAP_PATH)];
    if (remaps.length !== 1)
      invalid("Bild ohne eindeutige STEX-Zuordnung: " + sourcePath);
    const texture = entries.get(remaps[0]![1]!);
    if (!texture || texture.size < 44)
      invalid("Bild fehlt: " + sourcePath);
    const bytes = await readExact(source, texture.offset, 44);
    const view = new DataView(bytes.buffer);
    const ascii = (start: number, end: number) =>
      String.fromCharCode(...bytes.subarray(start, end));
    const width = view.getUint32(4, true), height = view.getUint32(8, true);
    if (ascii(0, 4) !== "GDST" || !width || !height ||
        view.getUint32(20, true) !== 1 || ascii(28, 32) !== "WEBP" ||
        ascii(32, 36) !== "RIFF" || ascii(40, 44) !== "WEBP" ||
        view.getUint32(24, true) !== texture.size - 28 ||
        view.getUint32(36, true) !== texture.size - 40)
      invalid("Nicht unterstütztes Bild: " + sourcePath);
    images.set(id, { offset: texture.offset + 32, size: texture.size - 32 });
    return { width, height };
  };
  for (const importPath of entries.keys()) {
    const match = PATH_IMPORT.exec(importPath);
    if (!match) continue;
    const sourcePath = importPath.slice(0, -".import".length);
    const id = nativePathId(sourcePath);
    const { width, height } = await imageDetails(sourcePath, id);
    const name = match[1]!
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    textures.push({
      asset: {
        id,
        packId: NATIVE_PATH_PACK_ID,
        kind: "path",
        name,
        files: { image: sourcePath },
        pathTexturePixels: { width, height },
      },
      sourcePath,
      width,
      height,
    });
  }
  if (!textures.length) invalid("Keine nativen Pfadtexturen gefunden.");
  textures.sort((a, b) => a.asset.name.localeCompare(b.asset.name, "en"));
  const design = async (kind: "tileset" | "wall", key: string) => {
    const path = `res://data/${kind === "tileset" ? "tilesets" : "walls"}/${key}.dungeondraft_${kind}`;
    const entry = entries.get(path);
    if (!entry || entry.size > 65_536)
      invalid("Stilmetadaten fehlen: " + path);
    const data: unknown = JSON.parse(decoder.decode(
      await readExact(source, entry.offset, entry.size)));
    if (!data || typeof data !== "object") invalid("Ungültiger Stil: " + path);
    const record = data as Record<string, unknown>;
    if (typeof record.path !== "string" ||
        !/^textures\/(tilesets|walls)\/[\w/]+\.png$/.test(record.path) ||
        typeof record.color !== "string" || !/^[\da-fA-F]{6}$/.test(record.color))
      invalid("Ungültiger Stil: " + path);
    const sourcePath = "res://" + record.path;
    const id = nativeDesignId(kind, sourcePath);
    const dimensions = await imageDetails(sourcePath, id);
    const name = kind === "tileset" ? record.name : key
      .replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    if (typeof name !== "string" || !name.trim()) invalid("Stilname fehlt: " + path);
    return { id, packId: NATIVE_PATH_PACK_ID, kind, name,
      files: { image: sourcePath }, color: record.color.toLowerCase(),
      ...(kind === "tileset" ? { nativeTileSizeFields: dimensions.width / 256 } : {}),
    } satisfies AssetDefinition;
  };
  for (const key of FLOOR_ORDER) floors.push(await design("tileset", key));
  for (const key of WALL_ORDER) walls.push(await design("wall", key));
  return {
    textures, floors, walls,
    image(assetId: string): Blob | undefined {
      const entry = images.get(assetId);
      return (
        entry &&
        source
          .slice(entry.offset, entry.offset + entry.size)
          .slice(0, undefined, "image/webp")
      );
    },
  };
}
