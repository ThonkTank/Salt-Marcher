export interface StorageTransaction<T> {
  run: () => Promise<T>;
  rollback: () => Promise<void>;
}

export interface StorageReadOptions {
  consistency: 'eventual' | 'strong';
  signal?: AbortSignal;
}

export interface StorageWriteOptions {
  transactional?: boolean;
  dryRun?: boolean;
  signal?: AbortSignal;
}

export interface StoragePort {
  read<T>(resource: string, options?: StorageReadOptions): Promise<T | null>;
  write<T>(resource: string, payload: T, options?: StorageWriteOptions): Promise<void>;
  transact<T>(steps: StorageTransaction<T>[], options?: StorageWriteOptions): Promise<T>;
  exists(resource: string): Promise<boolean>;
}

