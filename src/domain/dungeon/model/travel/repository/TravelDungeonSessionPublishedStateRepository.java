package src.domain.dungeon.model.travel.repository;

import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;

public interface TravelDungeonSessionPublishedStateRepository {

    void recordCurrentSession(SnapshotData snapshot);
}
