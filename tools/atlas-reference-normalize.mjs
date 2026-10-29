/** Rebuild only the pinned disposable reference fixture. Not a product migration. */
export function normalizeReferenceLandscapes(db, { presets, validate }) {
  const rows = db
    .prepare('SELECT campaign_id,id,revision,payload FROM atlas_landscape ORDER BY campaign_id,id')
    .all();
  const update = db.prepare('UPDATE atlas_landscape SET payload=? WHERE campaign_id=? AND id=?');
  const result = {
    records: rows.length,
    changedRecords: 0,
    upgradedPresets: 0,
    alignedPayloadRevisions: 0,
  };
  db.transaction(() => {
    for (const row of rows) {
      const record = JSON.parse(row.payload);
      if (record.revision !== row.revision) {
        record.revision = row.revision;
        result.alignedPayloadRevisions++;
      }
      if (record.vegetation) {
        const previous = record.vegetation.preset;
        const current = presets.find((preset) => preset.id === previous.id);
        if (!current) throw Error('Unknown pinned fixture vegetation preset: ' + previous.id);
        if (Object.keys(current).some((field) => !(field in previous))) {
          record.vegetation.preset = { ...current, ...previous };
          result.upgradedPresets++;
        }
      }
      validate(record);
      const payload = JSON.stringify(record);
      if (payload !== row.payload) {
        update.run(payload, row.campaign_id, row.id);
        result.changedRecords++;
      }
    }
  })();
  return result;
}
