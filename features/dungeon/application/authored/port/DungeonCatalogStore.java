package features.dungeon.application.authored.port;

import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.List;
import java.util.Optional;

/** Metadata-only catalog reads and mutations for authored Dungeon maps. */
public interface DungeonCatalogStore {

    List<DungeonMapHeader> search(String query);

    /** Metadata-only lookup; authored content is never hydrated. */
    default Optional<DungeonMapHeader> find(DungeonMapIdentity mapId) {
        if (mapId == null) {
            return Optional.empty();
        }
        return search("").stream().filter(header -> header.mapId().equals(mapId)).findFirst();
    }

    /** First metadata header in stable catalog order. */
    default Optional<DungeonMapHeader> first() {
        return search("").stream().findFirst();
    }

    DungeonMapHeader create(String mapName);

    DungeonMapHeader rename(DungeonMapIdentity mapId, String mapName);

    void delete(DungeonMapIdentity mapId);
}
