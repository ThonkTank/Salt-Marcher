import { PNG } from "pngjs";

/** Small valid GDPC packages for parser and catalog tests. */
export function assetPack(): Blob {
  const id = "portable-fixture",
    png = PNG.sync.write(new PNG({ width: 1, height: 1 }));
  const manifest = new TextEncoder().encode(JSON.stringify({
      id,
      name: "Portable fixture",
      allow_3rd_party_mapping_software_to_read: true,
    })),
    entries: [string, Uint8Array][] = [
      [`res://packs/${id}.json`, manifest],
      [`res://packs/${id}/textures/objects/fixture-object.png`, png],
      [`res://packs/${id}/data/walls/fixture-wall.dungeondraft_wall`,
        new TextEncoder().encode(JSON.stringify({
          path: "textures/walls/fixture-wall.png", color: "abcdef",
        }))],
      [`res://packs/${id}/textures/walls/fixture-wall.png`, png],
      [`res://packs/${id}/textures/walls/fixture-wall_end.png`, png],
      ...["tiles", "edge", "hip", "ridge"].map((part) =>
        [`res://packs/${id}/textures/roofs/fixture-roof/${part}.png`, png] as [string, Uint8Array]),
      ...["floor", "wall"].map((part) =>
        [`res://packs/${id}/textures/caves/colorable/${part}.png`, png] as [string, Uint8Array]),
      ...["tile", "border"].map((part) =>
        [`res://packs/${id}/textures/materials/fixture-material_${part}.png`, png] as [string, Uint8Array]),
    ],
    paths = entries.map(([path]) => new TextEncoder().encode(path)),
    directorySize = paths.reduce((size, path) => size + 4 + path.length + 32, 0),
    headerSize = 88 + directorySize,
    payloadSize = entries.reduce((size, [, bytes]) => size + bytes.length, 0),
    bytes = new Uint8Array(headerSize + payloadSize),
    header = new DataView(bytes.buffer);
  header.setUint32(0, 0x43504447, true);
  header.setUint32(4, 1, true);
  header.setUint32(84, entries.length, true);
  let directory = 88,
    payload = headerSize;
  entries.forEach(([, data], index) => {
    const path = paths[index]!;
    header.setUint32(directory, path.length, true);
    directory += 4;
    bytes.set(path, directory);
    directory += path.length;
    header.setBigUint64(directory, BigInt(payload), true);
    header.setBigUint64(directory + 8, BigInt(data.length), true);
    directory += 32;
    bytes.set(data, payload);
    payload += data.length;
  });
  return new Blob([bytes]);
}
