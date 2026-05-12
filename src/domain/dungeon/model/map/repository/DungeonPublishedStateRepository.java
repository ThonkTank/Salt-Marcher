package src.domain.dungeon.model.map.repository;

import src.domain.dungeon.model.map.model.DungeonMapIdentity;

public interface DungeonPublishedStateRepository {

    enum CatalogMutationKind {
        CREATED,
        RENAMED,
        DELETED
    }

    void publishAuthoredSnapshot(Object snapshot);

    void publishAuthoredInspector(Object snapshot);

    void publishAuthoredMutation(Object result);

    void publishMapCatalog(Object maps);

    void publishMapCatalogMutation(CatalogMutationKind mutationKind, DungeonMapIdentity mapId);

    void publishTravelSurface(Object surface);

    void publishTravelMove(Object result);
}
