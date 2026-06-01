package src.domain.dungeon.model.worldspace.repository;

import src.domain.dungeon.model.worldspace.model.DungeonMap;
import src.domain.dungeon.model.worldspace.model.DungeonMapIdentity;

import java.util.List;
import java.util.Optional;

/**
 * Repository contract for authored dungeon maps.
 */
public interface DungeonMapRepository {

    DungeonMapIdentity nextMapId();

    long nextStairId();

    long nextTransitionId();

    Optional<DungeonMap> findById(DungeonMapIdentity mapId);

    List<DungeonMap> searchByName(String query);

    Optional<DungeonMap> firstMap();

    DungeonMap save(DungeonMap dungeonMap);

    List<DungeonMap> saveAll(List<DungeonMap> dungeonMaps);

    void delete(DungeonMapIdentity mapId);
}
