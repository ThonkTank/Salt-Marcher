const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const table = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) crc = table[(crc ^ value) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type),
    body = Buffer.concat([name, data]),
    result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  body.copy(result, 4);
  result.writeUInt32BE(crc32(body), data.length + 8);
  return result;
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    for (let x = 0; x < size; x++) {
      const color = pixel(x, y);
      for (let channel = 0; channel < 4; channel++)
        raw[row + 1 + x * 4 + channel] = color[channel];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
function ring(cx, cy, rx, ry, count, wobble = 0) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2,
      scale = 1 + Math.sin(index * 2.3) * wobble;
    return {
      x: cx + Math.cos(angle) * rx * scale,
      y: cy + Math.sin(angle) * ry * scale,
    };
  });
}
function room(id, floorId, number, x, y) {
  return {
    id,
    kind: "building",
    floorId,
    name: "Raum " + number,
    number: String(number),
    polygons: [{ outer: [
      { x, y },
      { x: x + 7, y },
      { x: x + 7, y: y + 5 },
      { x, y: y + 5 },
    ], holes: [] }],
    layer: 200,
    wallWidth: 0.2,
    note: { path: `Dungeons/Grosskarte/Räume/${id}.md` },
    fill: 0xc6bda9,
    wall: 0x3d3b38,
  };
}
function prepareLarge(vault) {
  const dungeon = path.join(vault, "Dungeons/Grosskarte"),
    notes = path.join(dungeon, "Räume"),
    assets = path.join(vault, "Assets/dungeon-qa");
  fs.mkdirSync(notes, { recursive: true });
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(
    path.join(assets, "stone.png"),
    png(128, (x, y) => {
      const joint = x % 32 < 2 || y % 24 < 2,
        noise = (x * 17 + y * 29) % 19;
      return joint
        ? [72, 68, 62, 255]
        : [132 + noise, 126 + noise, 113 + noise, 255];
    }),
  );
  fs.writeFileSync(
    path.join(assets, "moss.png"),
    png(128, (x, y) => {
      const noise = (x * 13 + y * 7 + ((x * y) % 23)) % 34;
      return [70 + noise, 91 + noise, 58 + Math.floor(noise / 2), 255];
    }),
  );
  const floors = [
      { id: "floor-ground", name: "Erdgeschoss", elevation: 0, ambient: 0.72 },
      { id: "floor-upper", name: "Obergeschoss", elevation: 1, ambient: 0.88 },
    ],
    entities = [];
  for (const [floorIndex, floor] of floors.entries()) {
    const material = floorIndex ? "Assets/dungeon-qa/moss.png" : "Assets/dungeon-qa/stone.png";
    entities.push({
      id: `surface-cave-${floorIndex}`,
      kind: "surface",
      floorId: floor.id,
      category: "cave",
      polygons: [
        {
          outer: ring(102, 72, 94, 64, 96, 0.055),
          holes: [ring(102, 72, 17, 11, 36, 0.035)],
        },
      ],
      layer: -300,
      color: floorIndex ? 0x817b67 : 0x969080,
      material: { asset: material, tileSize: 6, tint: 0xffffff, rotation: 0 },
      wallColor: 0x363533,
      wallWidth: 0.34,
    });
    entities.push({
      id: `surface-material-${floorIndex}`,
      kind: "surface",
      floorId: floor.id,
      category: "material",
      polygons: [
        {
          outer: [
            { x: 14, y: 14 },
            { x: 190, y: 14 },
            { x: 190, y: 130 },
            { x: 14, y: 130 },
          ],
          holes: [ring(102, 72, 23, 16, 40)],
        },
      ],
      layer: 100,
      color: 0xa69c82,
      material: { asset: material, tileSize: 4, tint: 0xffffff, rotation: floorIndex * 0.2 },
      wallColor: 0,
      wallWidth: 0,
    });
    for (let index = 0; index < 96; index++) {
      const number = floorIndex * 96 + index + 1,
        id = `room-${floorIndex}-${index}`,
        x = 18 + (index % 16) * 10.5,
        y = 18 + Math.floor(index / 16) * 17;
      entities.push(room(id, floor.id, number, x, y));
      fs.writeFileSync(
        path.join(notes, id + ".md"),
        `---\nroom_id: "${id}"\n---\n# ${number} Raum ${number}\n\n`,
      );
      if (index % 3 === 0)
        entities.push({
          id: `door-${floorIndex}-${index}`,
          kind: "door",
          floorId: floor.id,
          anchor: { boundaryId: id, contour: 0, at: 3.5 / 24 },
          width: 1,
          variant: index % 9 === 0 ? "opening" : "door",
          blocksLight: index % 9 !== 0,
        });
    }
    for (let index = 0; index < 2000; index++)
      entities.push({
        id: `object-${floorIndex}-${index}`,
        kind: "object",
        floorId: floor.id,
        x: 10 + ((index * 37) % 180) + (index % 5) * 0.12,
        y: 10 + ((index * 53) % 120) + (index % 7) * 0.1,
        rotation: (index % 12) * (Math.PI / 6),
        width: 0.75 + (index % 4) * 0.16,
        height: 0.58 + (index % 3) * 0.18,
        color: [0x795438, 0x5f7255, 0x596d78, 0x8a684f][index % 4],
        label: index % 250 === 0 ? "ED" : "",
      });
    for (let index = 0; index < 16; index++)
      entities.push({
        id: `light-${floorIndex}-${index}`,
        kind: "light",
        floorId: floor.id,
        x: 18 + (index % 8) * 23,
        y: 28 + Math.floor(index / 8) * 70,
        radius: 9 + (index % 3) * 2,
        intensity: 0.8 + (index % 4) * 0.1,
        color: index % 2 ? 0xffc878 : 0x8ac7ff,
        shadows: true,
      });
  }
  const document = {
    format: "dungeon-map",
    version: 3,
    id: "large-native-fixture",
    settings: { name: "Großkarte", width: 204, height: 144, feetPerField: 5, wallShadows: true, objectShadows: true, buildingWear: 0 },
    floors,
    entities,
    content: { definitions: [], occurrences: [], routes: [], archive: [] },
  };
  fs.writeFileSync(path.join(dungeon, "Karte.dungeon"), JSON.stringify(document, null, 2) + "\n");
  return { path: "Dungeons/Grosskarte/Karte.dungeon", document };
}

function prepareLargeV4(vault) {
  const prepared = prepareLarge(vault), document = prepared.document;
  document.version = 4;
  document.id = "large-native-v4-phase7";
  for (const entity of document.entities) {
    if (entity.kind !== "building" || !entity.number) continue;
    delete entity.note;
    entity.key = { sections: [{ id: entity.id + "-section",
      kind: "markdown", markdown: "" }] };
  }
  const featureText = "*Wortlaut der großen Phase-7-Karte.*\n[[QA/Grosskarte|Quelle]]\n";
  const featureMarkdown = "## A · Zeichen:\n" +
    "<!-- dungeon-feature:large-occurrence-phase7:start -->\n" + featureText +
    "\n<!-- dungeon-feature:large-occurrence-phase7:end -->";
  document.entities.push({
    id: "room-phase7", kind: "building", floorId: "floor-ground",
    name: "Raum 193", number: "193", layer: 200,
    polygons: [{ outer: [{ x: 185, y: 120 }, { x: 193, y: 120 },
      { x: 193, y: 128 }, { x: 185, y: 128 }], holes: [] }],
    fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2,
    key: { sections: [{ id: "room-phase7-intro", kind: "markdown", markdown: "" },
      { id: "section-phase7", kind: "markdown", markdown: featureMarkdown }],
      nextFeatureOrdinal: 2 },
  });
  document.entities.push({ id: "object-phase7", kind: "object",
    floorId: "floor-ground", roomId: "room-phase7", x: 187, y: 122,
    rotation: 0, width: 2.5, height: 2.5, color: 0x6688aa,
    label: "Zeichen", layer: 100, flip: false });
  document.entities.push({ id: "light-phase7", kind: "light",
    floorId: "floor-ground", x: 180, y: 130,
    radius: 8, intensity: 1, color: 0xffd89a, shadows: true });
  document.content.definitions.push({ id: "definition-phase7", name: "Zeichen",
    kind: "feature", xp: 0, lootValue: 0 });
  document.content.occurrences.push({ id: "large-occurrence-phase7",
    definitionId: "definition-phase7", roomId: "room-phase7",
    entityId: "object-phase7", marker: "A", quantity: 1,
    sectionId: "section-phase7" });
  fs.rmSync(path.join(vault, "Dungeons/Grosskarte/Räume"), { recursive: true });
  fs.writeFileSync(path.join(vault, prepared.path), JSON.stringify(document, null, 2) + "\n");
  return { ...prepared, document, featureText };
}

module.exports = { prepareLarge, prepareLargeV4 };
