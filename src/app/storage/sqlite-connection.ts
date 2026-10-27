/** Structural subset of better-sqlite3 used by canonical storage modules.
 * Reads are untrusted until a domain decoder or checkedQuery validates them. */
export type SqliteValue = null | string | number | bigint | Uint8Array;
export type SqliteRow = Record<string, unknown>;
export interface SqliteStatement {
  get(...bindings: SqliteValue[]): SqliteRow | undefined;
  all(...bindings: SqliteValue[]): SqliteRow[];
  iterate(...bindings: SqliteValue[]): IterableIterator<SqliteRow>;
  run(...bindings: SqliteValue[]): { changes: number; lastInsertRowid: number | bigint };
}
export interface SqliteTransaction<Args extends unknown[], Result> {
  (...args: Args): Result;
  deferred(...args: Args): Result;
  immediate(...args: Args): Result;
  exclusive(...args: Args): Result;
}
export interface SqliteDatabase {
  readonly readonly: boolean;
  readonly inTransaction: boolean;
  prepare(sql: string): SqliteStatement;
  exec(sql: string): unknown;
  pragma(sql: string, options?: { simple?: boolean }): unknown;
  transaction<Args extends unknown[], Result>(
    operation: (...args: Args) => Result & (Result extends PromiseLike<unknown> ? never : unknown),
  ): SqliteTransaction<Args, Result>;
}

type Column = 'text' | 'integer' | 'number' | 'nullable-text' | 'nullable-integer';
type Columns = Record<string, Column>;
type CheckedRow<S extends Columns> = {
  [K in keyof S]: S[K] extends 'text'
    ? string
    : S[K] extends 'nullable-integer'
      ? number | null
      : S[K] extends 'nullable-text'
        ? string | null
        : number;
};
/** Check SQL projection fields without altering payloads, extra columns or stored bytes. */
export function checkedRow<const S extends Columns>(value: unknown, columns: S): CheckedRow<S> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Datenbankzeile fehlt oder ist beschädigt. Originaldaten bleiben erhalten.');
  const row = value as Record<string, unknown>;
  for (const [name, kind] of Object.entries(columns)) {
    const value = row[name];
    const valid =
      kind === 'text'
        ? typeof value === 'string'
        : kind === 'nullable-text'
          ? value === null || typeof value === 'string'
          : kind === 'nullable-integer'
            ? value === null || (typeof value === 'number' && Number.isSafeInteger(value))
            : typeof value === 'number' &&
              (kind === 'integer' ? Number.isSafeInteger(value) : Number.isFinite(value));
    if (!valid)
      throw new Error(`Datenbankfeld ${name} ist beschädigt. Originaldaten bleiben erhalten.`);
  }
  return value as CheckedRow<S>;
}
/** SQL and its exact read projection stay together at the owning read boundary. */
export function checkedQuery<const S extends Columns>(db: SqliteDatabase, sql: string, columns: S) {
  const statement = db.prepare(sql);
  return {
    get(...bindings: SqliteValue[]) {
      const row = statement.get(...bindings);
      return row === undefined ? undefined : checkedRow(row, columns);
    },
    required(...bindings: SqliteValue[]) {
      return checkedRow(statement.get(...bindings), columns);
    },
    all(...bindings: SqliteValue[]) {
      return statement.all(...bindings).map((row) => checkedRow(row, columns));
    },
    *iterate(...bindings: SqliteValue[]) {
      for (const row of statement.iterate(...bindings)) yield checkedRow(row, columns);
    },
  };
}

/** PRAGMA scalar values are untrusted just like row fields. */
export function sqliteInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value))
    throw new Error('Ungültiger ganzzahliger Datenbankwert.');
  return value;
}
