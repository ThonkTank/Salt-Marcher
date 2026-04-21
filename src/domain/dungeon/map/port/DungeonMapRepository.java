package src.domain.dungeon.map.port;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.value.DungeonMapIdentity;

import java.util.Optional;

/**
 * Repository contract for authored dungeon maps.
 */
public interface DungeonMapRepository {

    DungeonMapIdentity nextMapId();

    Optional<DungeonMap> findById(DungeonMapIdentity mapId);

    DungeonMap save(DungeonMap dungeonMap);

    void delete(DungeonMapIdentity mapId);
}
