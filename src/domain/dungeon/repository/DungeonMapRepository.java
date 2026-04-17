package src.domain.dungeon.repository;

import src.domain.dungeon.api.DungeonMapId;
import src.domain.dungeon.entity.DungeonMap;

import java.util.List;
import java.util.Optional;

/**
 * Repository contract for authored dungeon maps.
 */
public interface DungeonMapRepository {

    List<DungeonMap> searchByName(String query);

    Optional<DungeonMap> findById(DungeonMapId mapId);

    DungeonMap save(DungeonMap dungeonMap);

    void delete(DungeonMapId mapId);

    DungeonMapId nextId();
}
