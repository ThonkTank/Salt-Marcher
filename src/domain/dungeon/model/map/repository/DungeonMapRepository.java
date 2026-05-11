package src.domain.dungeon.model.map.repository;

import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;

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
