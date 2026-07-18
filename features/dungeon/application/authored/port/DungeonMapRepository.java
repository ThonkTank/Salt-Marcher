package features.dungeon.application.authored.port;

import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.DungeonMap;

import java.util.List;
import java.util.Optional;

/**
 * Repository contract for authored dungeon maps.
 */
public interface DungeonMapRepository {

    long nextStairId();

    long nextTransitionId();

    Optional<DungeonMap> findById(DungeonMapIdentity mapId);

    Optional<DungeonMap> firstMap();

    /**
     * Persists the supplied authored maps as one all-or-none multi-map boundary
     * and returns the saved readback for each committed map.
     */
    List<DungeonMap> saveAll(List<DungeonMap> dungeonMaps);

}
