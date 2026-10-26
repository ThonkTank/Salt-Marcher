import type { SqliteDatabase } from '../../src/app/storage/sqlite-connection';
import { storedEdit } from '../../src/app/storage/stored-records';
import { commitPreparation } from '../../src/app/storage/preparation';
import type { Edit } from '../../src/app/shared/contracts';
import type { PreparationCommand } from '../../src/app/campaign/preparation-contracts';

// Included by check; these deliberately invalid connections must stay rejected.
export function storagePortTypeChecks(db: SqliteDatabase, edit: Edit, command: PreparationCommand) {
  const transaction = db.transaction((n: number) => n + 1);
  const result: number = transaction.immediate(1);
  // @ts-expect-error Synchronous SQLite cannot keep a transaction open across a Promise.
  db.transaction(async () => result);
  // @ts-expect-error Bindings cannot contain an arbitrary domain command.
  db.prepare('SELECT ?').get(command);
  const row = db.prepare('SELECT revision FROM room').get();
  // @ts-expect-error SQL columns require a checked read boundary.
  const revision: number = row?.revision;
  void revision;
  storedEdit(
    db,
    {
      guard: () => 'campaign',
      // @ts-expect-error A preparation command writer cannot stand in for a room writer.
      writeRoom: (_campaign: string, _command: PreparationCommand) => {},
    },
    edit,
  );
  commitPreparation(db, command, {
    activeCampaignId: 'campaign',
    graphPreviewOpen: false,
    guard: () => 'campaign',
    // @ts-expect-error The nested preparation writer requires a PreparationCommand.
    commitPreparation: (_edit: Edit) => {},
    executeSession: () => {},
  });
}

export function atlasPortTypeChecks(
  ports: Parameters<typeof import('../../src/app/storage/atlas-travel').storedApplyAtlasTravel>[1],
) {
  const invalid: typeof ports = {
    ...ports,
    // @ts-expect-error A room edit cannot be connected as a live-session command.
    executeLive: (_command: Edit) => {},
  };
  void invalid;
  const invalidRead: typeof ports = {
    ...ports,
    // @ts-expect-error The travel owner requires a real LiveScene, not an arbitrary result.
    liveScene: () => ({ revision: 1 }),
  };
  void invalidRead;
}
