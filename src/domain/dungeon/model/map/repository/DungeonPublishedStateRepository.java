package src.domain.dungeon.model.map.repository;

import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTravelMoveFacts;
import src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonMapCatalogResponse;

public interface DungeonPublishedStateRepository {

    void publishAuthoredSnapshot(DungeonAuthoredReadResult snapshot);

    void publishAuthoredInspector(DungeonAuthoredReadResult snapshot);

    void publishAuthoredMutation(DungeonAuthoredMutationResult result);

    void publishMapCatalog(DungeonMapCatalogResponse maps);

    void publishMapCreated(DungeonMapIdentity mapId);

    void publishMapRenamed(DungeonMapIdentity mapId);

    void publishMapDeleted(DungeonMapIdentity mapId);

    void publishTravelSurface(DungeonTravelSurfaceFacts surface);

    void publishTravelMove(DungeonTravelMoveFacts result);
}
