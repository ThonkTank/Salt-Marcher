declare module 'better-sqlite3' {
  // The implementation lives in the native host; values remain untrusted rows.
  const Database: new (
    filename: string,
    options?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number },
  ) => import('./sqlite-connection').SqliteDatabase & {
    readonly name: string;
    close(): void;
    backup(filename: string): Promise<{ totalPages: number; remainingPages: number }>;
    function(
      name: string,
      options: { deterministic?: boolean; varargs?: boolean },
      callback: (
        ...args: import('./sqlite-connection').SqliteValue[]
      ) => import('./sqlite-connection').SqliteValue,
    ): unknown;
  };
  export default Database;
}
