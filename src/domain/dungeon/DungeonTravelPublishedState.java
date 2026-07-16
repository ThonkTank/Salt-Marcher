package src.domain.dungeon;

import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.domain.shared.published.PublishedState;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;

final class DungeonTravelPublishedState {

    private final PublishedState<TravelDungeonSnapshot> snapshots;
    private final TravelDungeonModel travelModel;

    DungeonTravelPublishedState() {
        this(DirectUiDispatcher.INSTANCE);
    }

    DungeonTravelPublishedState(UiDispatcher dispatcher) {
        snapshots = new PublishedState<>(TravelDungeonSnapshot.empty(), dispatcher);
        travelModel = new TravelDungeonModel(snapshots::current, snapshots::subscribe);
    }

    TravelDungeonModel travelModel() {
        return travelModel;
    }

    void publish(TravelDungeonSessionSnapshot.SnapshotData snapshot) {
        snapshots.publish(DungeonTravelPublishedProjection.snapshot(snapshot));
    }
}
