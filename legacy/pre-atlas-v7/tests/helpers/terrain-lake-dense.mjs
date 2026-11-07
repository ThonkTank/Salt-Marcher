/** Real local additive terrain, shared by the worker and native lake lanes.
 * Each density adds 900 distinct 64² author tiles at a finer resolution. */
export function seedDenseLakeTerrain(api, db, campaignId, density = 1, offset = { x: 0, y: 0 }) {
  const put = db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
  let bytes = 0,
    count = 0;
  db.transaction(() => {
    for (let band = 0; band < density; band++) {
      const pixel = 0.125 / 2 ** band,
        side = 64 * pixel;
      for (let y = -15; y < 15; y++)
        for (let x = -15; x < 15; x++) {
          const r = api.heightRecord(
            offset.x + x * side,
            offset.y + y * side,
            pixel,
            Float32Array.from(
              { length: 4096 },
              (_, i) =>
                0.04 *
                Math.sin((x * 64 + (i % 64)) / 7) *
                Math.cos((y * 64 + Math.floor(i / 64)) / 11),
            ),
            2,
          );
          r.revision = 1;
          const payload = JSON.stringify(r);
          bytes += Buffer.byteLength(payload);
          count++;
          put.run(
            campaignId,
            r.id,
            1,
            r.height.x - pixel,
            r.height.x + 64 * pixel,
            r.height.y - pixel,
            r.height.y + 64 * pixel,
            payload,
          );
        }
    }
  })();
  return { count, bytes, density };
}
