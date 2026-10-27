import Database from 'better-sqlite3';
import { checkedRow, sqliteInteger } from '../../src/app/storage/sqlite-connection';
// Compile-only contract: the native driver's data cannot become trusted via inference.
function read(filename: string) {
  const db = new Database(filename, { readonly: true });
  const row = db.prepare('SELECT name FROM campaign').get();
  // @ts-expect-error native rows may be missing and their values are unknown
  const unchecked: string = row.name;
  // @ts-expect-error PRAGMA is untrusted until decoded
  const schema: number = db.pragma('user_version', { simple: true });
  const name: string = checkedRow(row, { name: 'text' }).name;
  const checkedSchema: number = sqliteInteger(db.pragma('user_version', { simple: true }));
  db.close();
  return { name, checkedSchema, unchecked, schema };
}
void read;
