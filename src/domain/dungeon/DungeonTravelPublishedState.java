package src.domain.dungeon;

import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.domain.shared.published.PublishedState;

final class DungeonTravelPublishedState {

    private final PublishedState<TravelDungeonSnapshot> snapshots =
            PublishedState.retainingDuplicateSubscribers(TravelDungeonSnapshot.empty());
    private final TravelDungeonModel travelModel =
            new TravelDungeonModel(snapshots::current, snapshots::subscribe);

    TravelDungeonModel travelModel() {
        return travelModel;
    }

    void publish(TravelDungeonSessionSnapshot.SnapshotData snapshot) {
        snapshots.publish(DungeonTravelPublishedProjection.snapshot(snapshot));
    }
}
