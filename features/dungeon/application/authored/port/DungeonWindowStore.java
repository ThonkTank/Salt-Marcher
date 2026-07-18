package features.dungeon.application.authored.port;

import java.util.Optional;

/** Sparse authored read port for explicit chunk windows and exact identity closure. */
public interface DungeonWindowStore {

    Optional<DungeonWindow> loadWindow(DungeonWindowRequest request);

    DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request);
}
