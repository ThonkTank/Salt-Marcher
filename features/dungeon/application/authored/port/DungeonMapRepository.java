package features.dungeon.application.authored.port;

import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.DungeonMap;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.DungeonViewportRequest;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Repository contract for authored dungeon maps.
 */
public interface DungeonMapRepository {

    long nextStairId();

    long nextTransitionId();

    Optional<DungeonMap> findById(DungeonMapIdentity mapId);

    Optional<DungeonMap> firstMap();

    DungeonMap save(DungeonMap dungeonMap);

    /** Persists one revision-checked authored delta without requiring readback. */
    default DungeonMap saveChange(DungeonChangeSet changeSet) {
        return save(changeSet.after());
    }

    /**
     * Persists the supplied authored maps as one all-or-none multi-map boundary
     * and returns the saved readback for each committed map.
     */
    List<DungeonMap> saveAll(List<DungeonMap> dungeonMaps);

    default Set<DungeonChunkKey> findAvailableChunks(DungeonViewportRequest request) {
        return Set.of();
    }
}
