package src.domain.dungeon;

import src.domain.dungeon.model.runtime.repository.TravelDungeonSessionPublishedStateRepository;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.domain.shared.published.PublishedState;

final class DungeonTravelPublishedState implements TravelDungeonSessionPublishedStateRepository {

    private final PublishedState<TravelDungeonSnapshot> snapshots =
            PublishedState.retainingDuplicateSubscribers(TravelDungeonSnapshot.empty());
    private final TravelDungeonModel travelModel =
            new TravelDungeonModel(snapshots::current, snapshots::subscribe);

    TravelDungeonModel travelModel() {
        return travelModel;
    }

    @Override
    public void publishCurrentSession(TravelDungeonSessionSnapshot.SnapshotData snapshot) {
        snapshots.publish(DungeonTravelPublishedProjection.snapshot(snapshot));
    }
}
