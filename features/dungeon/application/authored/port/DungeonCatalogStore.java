package features.dungeon.application.authored.port;

import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.List;

/** Metadata-only catalog reads and mutations for authored Dungeon maps. */
public interface DungeonCatalogStore {

    List<DungeonMapHeader> search(String query);

    DungeonMapHeader create(String mapName);

    DungeonMapHeader rename(DungeonMapIdentity mapId, String mapName);

    void delete(DungeonMapIdentity mapId);
}
