import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function convertEntity(entity) {
  if (entity.kind === "room") {
    const { points, ...rest } = entity;
    return {
      ...rest,
      kind: "building",
      polygons: [{ outer: points, holes: [] }],
      layer: 200,
      wallWidth: 0.2,
    };
  }
  if (entity.kind === "surface" && entity.category === "floor") {
    if (
      (entity.opacity !== undefined && entity.opacity !== 1) ||
      (entity.effect !== undefined && entity.effect !== "none")
    )
      throw new Error(
        `Bodenfläche ${entity.id} besitzt nicht verlustfrei abbildbare Effekte.`,
      );
    const {
      category: _category,
      color,
      wallColor,
      opacity: _opacity,
      effect: _effect,
      ...rest
    } = entity;
    return {
      ...rest,
      kind: "building",
      fill: color,
      wall: wallColor,
    };
  }
  if (entity.kind === "door" && entity.boundaryId) {
    const { boundaryId, at, ...rest } = entity;
    if (!Number.isFinite(at) || at < 0 || at > 1)
      throw new Error(`Portal ${entity.id} besitzt einen ungültigen Anker.`);
    return {
      ...rest,
      anchor: { boundaryId, contour: 0, at },
    };
  }
  return structuredClone(entity);
}

export function convertV1Document(source) {
  if (
    !source ||
    source.format !== "dungeon-map" ||
    source.version !== 1 ||
    !Array.isArray(source.entities) ||
    !source.content ||
    !Array.isArray(source.content.archive)
  )
    throw new Error("Erwartet wird genau eine Dungeonkarte der Version 1.");
  return {
    ...structuredClone(source),
    version: 2,
    entities: source.entities.map(convertEntity),
    content: {
      ...structuredClone(source.content),
      archive: source.content.archive.map((bundle) => ({
        ...bundle,
        entities: bundle.entities.map(convertEntity),
      })),
    },
  };
}

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw new Error(
      "Aufruf: node tools/migrate-building-v2.mjs QUELLE.dungeon ZIEL.dungeon",
    );
  if (resolve(input) === resolve(output))
    throw new Error("Quelle und Ziel müssen verschiedene Dateien sein.");
  const source = JSON.parse(await readFile(input, "utf8")),
    converted = convertV1Document(source);
  await writeFile(output, JSON.stringify(converted, null, 2) + "\n", {
    flag: "wx",
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
