package src.domain.dungeon.map.repository;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.value.DungeonMapIdentity;

import java.util.List;
import java.util.Optional;

/**
 * Repository contract for authored dungeon maps.
 */
public interface DungeonMapRepository {

    List<DungeonMap> searchByName(String query);

    Optional<DungeonMap> findById(DungeonMapIdentity mapId);

    DungeonMap save(DungeonMap dungeonMap);

    void delete(DungeonMapIdentity mapId);

    DungeonMapIdentity nextId();
}
