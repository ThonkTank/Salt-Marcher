package src.domain.dungeon.model.map.repository;

public interface DungeonPublishedStateRepository {

    void publishAuthoredRead(Object result);

    void publishAuthoredMutation(Object result);

    void publishMapCatalog(Object response);

    void publishTravel(Object response);
}
