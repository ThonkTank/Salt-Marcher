package features.dungeon.application.travel;

import features.dungeon.application.travel.session.TravelDungeonSessionSnapshot;
import features.dungeon.api.TravelDungeonModel;
import features.dungeon.api.TravelDungeonSnapshot;
import platform.state.PublishedState;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;

public final class DungeonTravelPublishedState {

    private final PublishedState<TravelDungeonSnapshot> snapshots;
    private final TravelDungeonModel travelModel;

    DungeonTravelPublishedState() {
        this(DirectUiDispatcher.INSTANCE);
    }

    public DungeonTravelPublishedState(UiDispatcher dispatcher) {
        snapshots = new PublishedState<>(TravelDungeonSnapshot.empty(), dispatcher);
        travelModel = new TravelDungeonModel(snapshots::current, snapshots::subscribe);
    }

    public TravelDungeonModel travelModel() {
        return travelModel;
    }

    void publish(TravelDungeonSessionSnapshot.SnapshotData snapshot) {
        snapshots.publish(DungeonTravelPublishedProjection.snapshot(snapshot));
    }
}
