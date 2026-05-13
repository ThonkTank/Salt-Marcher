package src.domain.dungeon.model.map.repository;

import src.domain.dungeon.model.map.model.DungeonMapIdentity;

public interface DungeonPublishedStateRepository {

    void publishAuthoredSnapshot(Object snapshot);

    void publishAuthoredInspector(Object snapshot);

    void publishAuthoredMutation(Object result);

    void publishMapCatalog(Object maps);

    void publishMapCreated(DungeonMapIdentity mapId);

    void publishMapRenamed(DungeonMapIdentity mapId);

    void publishMapDeleted(DungeonMapIdentity mapId);

    void publishTravelSurface(Object surface);

    void publishTravelMove(Object result);
}
