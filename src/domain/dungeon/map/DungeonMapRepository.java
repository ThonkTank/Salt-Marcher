package src.domain.dungeon.map;

import src.domain.dungeon.api.DungeonMapId;

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
