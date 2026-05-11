package src.domain.dungeon.map.port;

import src.domain.dungeon.model.map.model.DungeonMap;

import java.util.List;
import java.util.Optional;

/**
 * Read-only map catalog lookup needed by dungeon application use cases.
 */
public interface DungeonMapSearch {

    List<DungeonMap> searchByName(String query);

    Optional<DungeonMap> firstMap();
}
