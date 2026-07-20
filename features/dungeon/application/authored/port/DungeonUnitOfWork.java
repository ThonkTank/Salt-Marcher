package features.dungeon.application.authored.port;

import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;

/** Revision-checked authored patch commit boundary. */
public interface DungeonUnitOfWork {

    DungeonUnitOfWorkResult commit(DungeonPatch patch);

    DungeonCompoundUnitOfWorkResult commit(DungeonCompoundPatch patch);
}
