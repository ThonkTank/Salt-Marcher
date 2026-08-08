/**
 * Canonical application-layer result for a successful create or update.
 * The owning aggregate produces both values inside the same mutation.
 */
export type EntityMutationReceipt<TEntity, TSnapshot> = Readonly<{
  snapshot: TSnapshot
  saved: TEntity
}>

/** Canonical application-layer result for a successful delete. */
export type EntityDeleteReceipt<TSnapshot> = Readonly<{
  snapshot: TSnapshot
  deletedId: string
}>
