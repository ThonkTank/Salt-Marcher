package src.domain.dungeon.model.worldspace.repository;

import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;

public interface TravelDungeonSessionPublishedStateRepository {

    void publishCurrentSession(SnapshotData snapshot);
}
