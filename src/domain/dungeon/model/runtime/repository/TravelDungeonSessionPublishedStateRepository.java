package src.domain.dungeon.model.runtime.repository;

import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot.SnapshotData;

public interface TravelDungeonSessionPublishedStateRepository {

    void publishCurrentSession(SnapshotData snapshot);
}
