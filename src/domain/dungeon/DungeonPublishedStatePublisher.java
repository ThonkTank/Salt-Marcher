package src.domain.dungeon;

import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonTravelResponse;

public interface DungeonPublishedStatePublisher {

    void publishAuthoredRead(DungeonAuthoredReadResult result);

    void publishAuthoredMutation(DungeonAuthoredMutationResult result);

    void publishMapCatalog(DungeonMapCatalogResponse response);

    void publishTravel(DungeonTravelResponse response);
}
