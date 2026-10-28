import { type SqliteDatabase, checkedQuery } from './sqlite-connection';
export function atlasRoot(db: SqliteDatabase, cam: string) {
  const root = checkedQuery(db, 'SELECT * FROM campaign_atlas WHERE campaign_id=?', {
    campaign_id: 'text',
    map_id: 'text',
    revision: 'integer',
    cursor: 'integer',
  }).get(cam);
  if (!root)
    throw new Error(
      'Dieser alte Testbestand besitzt noch keinen gemeinsamen Atlas. Neue Kampagne anlegen.',
    );
  return root;
}
