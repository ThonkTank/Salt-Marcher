// One canonical source for the offline and native river qualification.
export const riverAnchors = [
  { x: -160, y: 0 },
  { x: 0, y: 0 },
  { x: 420, y: 0 },
];
export function riverTerrain(api, depression = 0) {
  return [-1, 0].flatMap((y) =>
    [-1, 0].map((x) =>
      api.heightRecord(
        x * 512,
        y * 512,
        8,
        Float32Array.from({ length: 4096 }, (_, i) => {
          const xx = x * 512 + (i % 64) * 8;
          // The trough crosses the entire 400m search corridor. Its centre is
          // mandatory; the downstream shoulder cannot be avoided by searching.
          const trough = Math.max(0, Math.min(1, (40 - Math.abs(xx)) / 16));
          return 20 - 0.05 * xx - depression * trough;
        }),
      ),
    ),
  );
}
export function riverSamples(api, records, river, spacing = 0.25) {
  const raw = new api.TerrainSampler(records, false),
    effective = new api.TerrainSampler([...records.filter((r) => r.id !== river.id), river]),
    out = [];
  let station = 0;
  for (let i = 1; i < river.route.nodes.length; i++) {
    const a = river.route.nodes[i - 1],
      b = river.route.nodes[i],
      length = Math.hypot(b.x - a.x, b.y - a.y),
      count = Math.max(1, Math.ceil(length / spacing));
    for (let j = i === 1 ? 0 : 1; j <= count; j++) {
      const t = j / count,
        p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        z = a.z + (b.z - a.z) * t;
      out.push({
        ...p,
        station: station + length * t,
        profile: z,
        base: raw.sample(p).heightM,
        bed: effective.sample(p).heightM,
        water: effective.waterLevel(p),
      });
    }
    station += length;
  }
  return out;
}

// A one-metre source grid with a transverse ridge hidden between the original
// width-based profile nodes. Both native terrain sampling and the planner read
// these canonical tiles; it is not a synthetic sampler stub.
export function riverRidgeTerrain(api, ridgeX = -154, rise = 10) {
  const records = riverTerrain(api);
  for (let y = -4; y < 4; y++)
    records.push(
      api.heightRecord(
        -192,
        y * 64,
        1,
        Float32Array.from({ length: 4096 }, (_, i) => {
          const x = -192 + (i % 64);
          return 20 - 0.05 * x + (x === ridgeX ? rise : 0);
        }),
      ),
    );
  return records;
}
