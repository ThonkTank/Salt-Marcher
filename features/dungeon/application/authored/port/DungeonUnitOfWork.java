package features.dungeon.application.authored.port;

import features.dungeon.application.authored.command.DungeonPatch;

/** Revision-checked single-map authored patch commit boundary. */
public interface DungeonUnitOfWork {

    DungeonUnitOfWorkResult commit(DungeonPatch patch);
}
