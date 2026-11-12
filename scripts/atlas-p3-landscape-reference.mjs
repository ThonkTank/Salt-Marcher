// Deliberately independent full-source oracle. No imports from the product,
// no overview payloads, no spatial index, no cached inherited values.
const LIMIT = 100_000_000;
const SOURCE_SIDE = 64;
const GRID_SIDE = 128;

function levelRange(minLevel, maxLevel) {
  if (
    !Number.isInteger(minLevel) ||
    minLevel < 0 ||
    minLevel > 25 ||
    !Number.isInteger(maxLevel) ||
    maxLevel < 0 ||
    maxLevel > 24
  )
    throw new RangeError("Invalid independent landscape level range");
}

function validateSource(source) {
  if (
    !source ||
    !Number.isInteger(source.level) ||
    source.level < 0 ||
    source.level > 24 ||
    !Number.isSafeInteger(source.tileX) ||
    !Number.isSafeInteger(source.tileY) ||
    !(source.mask instanceof Uint8Array) ||
    source.mask.length !== SOURCE_SIDE ** 2 ||
    !(source.values instanceof Uint8Array) ||
    source.values.length !== SOURCE_SIDE ** 2 * 4
  )
    throw new Error("Invalid independent landscape source");
}

/** Half-open interior cells; +LIMIT is owned by the last interior cell. */
function cellAt(value, step) {
  return value === LIMIT
    ? Math.ceil(value / step) - 1
    : Math.floor(value / step);
}

export function referenceLandscapeSample(
  sources,
  x,
  y,
  { minLevel = 0, maxLevel = 24 } = {},
) {
  levelRange(minLevel, maxLevel);
  if (!Number.isFinite(x) || !Number.isFinite(y))
    throw new RangeError("Invalid independent landscape point");
  if (!Array.isArray(sources))
    throw new TypeError("Missing complete landscape sources");
  if (Math.abs(x) > LIMIT || Math.abs(y) > LIMIT) return [0, 0, 0, 0];
  let winner = null;
  let winnerLevel = Infinity;
  for (const source of sources) {
    validateSource(source);
    if (source.level < minLevel || source.level > maxLevel) continue;
    const step = 2 ** source.level;
    const cx = cellAt(x, step) - source.tileX * SOURCE_SIDE;
    const cy = cellAt(y, step) - source.tileY * SOURCE_SIDE;
    if (cx < 0 || cx >= SOURCE_SIDE || cy < 0 || cy >= SOURCE_SIDE) continue;
    const index = cy * SOURCE_SIDE + cx;
    const mask = source.mask[index];
    if (mask !== 0 && mask !== 1)
      throw new Error("Nonbinary landscape author mask");
    if (!mask) continue;
    const weights = Array.from(
      source.values.subarray(index * 4, index * 4 + 4),
    );
    if (weights.reduce((sum, value) => sum + value, 0) > 255)
      throw new Error("Invalid landscape coverage sum");
    if (source.level < winnerLevel) {
      winner = weights;
      winnerLevel = source.level;
    }
  }
  return winner ?? [0, 0, 0, 0];
}

/** Samples the unmodified world lattice, including at a clipped world edge. */
export function referenceLandscapeGrid(sources, power, tileX, tileY) {
  if (
    !Number.isInteger(power) ||
    power < -8 ||
    power > 24 ||
    !Number.isSafeInteger(tileX) ||
    !Number.isSafeInteger(tileY)
  )
    throw new RangeError("Invalid independent landscape raster");
  const step = 2 ** power;
  const output = new Uint8Array(GRID_SIDE ** 2 * 4);
  for (let row = 0; row < GRID_SIDE; row++)
    for (let column = 0; column < GRID_SIDE; column++) {
      const x = (tileX * GRID_SIDE + column + 0.5) * step;
      const y = (tileY * GRID_SIDE + row + 0.5) * step;
      output.set(
        referenceLandscapeSample(sources, x, y),
        (row * GRID_SIDE + column) * 4,
      );
    }
  return output;
}
