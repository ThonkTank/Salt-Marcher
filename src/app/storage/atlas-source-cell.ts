/** Canonical cell lookup and its matching derived index. Broken records stay
 * readable by diagnostics and never prevent unrelated campaigns from opening. */
const columns = ["mapId", "level", "q", "r"].map(
  (key) =>
    `CASE WHEN json_valid(payload) THEN json_extract(payload,'$.sourceCell.${key}') END`,
);
export const sourceCellLookup = `SELECT id,revision FROM atlas_landscape WHERE campaign_id=? AND ${columns.map((column) => column + "=?").join(" AND ")}`;
export function installSourceCellIndex(db: any) {
  const old = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='index' AND name='landscape_source_cell'",
    )
    .get();
  db.transaction(() => {
    // Replace only our earlier unguarded derived index, preserving every source row.
    if (old && !old.sql.includes("json_valid"))
      db.exec("DROP INDEX landscape_source_cell");
    db.exec(
      `CREATE INDEX IF NOT EXISTS landscape_source_cell ON atlas_landscape(campaign_id,${columns.join(",")}) WHERE ${columns[0]} IS NOT NULL`,
    );
  })();
}
