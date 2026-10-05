import type { AssetDefinition, BinarySource } from "../../assets";

/** The locally inspected Dungeondraft 1.2.0.1 Linux resource archive. */
export const NATIVE_PATH_PCK_SHA256 =
  "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60";
export const NATIVE_PATH_PACK_ID = "dungeondraft-builtin-1.2.0.1";

export interface NativePathTexture {
  readonly asset: AssetDefinition;
  readonly sourcePath: string;
  readonly width: number;
  readonly height: number;
}

export interface NativePathCatalog {
  readonly textures: readonly NativePathTexture[];
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

/** Reads metadata and texture headers only. Image bytes remain slices of source. */
export async function readNativePathCatalog(
  source: BinarySource,
): Promise<NativePathCatalog> {
  const entries = await readDirectory(source);
  const textures: NativePathTexture[] = [];
  const images = new Map<string, Blob>();
  for (const [importPath, metadata] of entries) {
    const match = PATH_IMPORT.exec(importPath);
    if (!match) continue;
    const sourcePath = importPath.slice(0, -".import".length);
    if (metadata.size > 65_536)
      invalid("Pfadmetadaten sind zu groß: " + sourcePath);
    const text = decoder.decode(
      await readExact(source, metadata.offset, metadata.size),
    );
    const remaps = [...text.matchAll(REMAP_PATH)];
    if (remaps.length !== 1)
      invalid("Pfadtextur ohne eindeutige STEX-Zuordnung: " + sourcePath);
    const texture = entries.get(remaps[0]![1]!);
    if (!texture || texture.size < 44)
      invalid("Pfadtextur fehlt: " + sourcePath);
    const bytes = await readExact(source, texture.offset, 44);
    const view = new DataView(bytes.buffer);
    const ascii = (start: number, end: number) =>
      String.fromCharCode(...bytes.subarray(start, end));
    const width = view.getUint32(4, true),
      height = view.getUint32(8, true);
    const webpLength = view.getUint32(24, true);
    const riffLength = view.getUint32(36, true);
    if (
      ascii(0, 4) !== "GDST" ||
      !width ||
      !height ||
      view.getUint32(20, true) !== 1 ||
      ascii(28, 32) !== "WEBP" ||
      ascii(32, 36) !== "RIFF" ||
      ascii(40, 44) !== "WEBP" ||
      webpLength !== texture.size - 28 ||
      riffLength !== texture.size - 40
    )
      invalid("Nicht unterstützte Pfadtextur: " + sourcePath);
    const id = nativePathId(sourcePath);
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
    images.set(id, source
      .slice(texture.offset + 32, texture.offset + texture.size)
      .slice(0, undefined, "image/webp"));
  }
  if (!textures.length) invalid("Keine nativen Pfadtexturen gefunden.");
  textures.sort((a, b) => a.asset.name.localeCompare(b.asset.name, "en"));
  return {
    textures,
    image(assetId: string): Blob | undefined {
      return images.get(assetId);
    },
  };
}
