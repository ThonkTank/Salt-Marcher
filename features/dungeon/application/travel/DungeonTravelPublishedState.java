package features.dungeon.application.travel;

import features.dungeon.application.travel.session.TravelDungeonSessionSnapshot;
import features.dungeon.api.TravelDungeonModel;
import features.dungeon.api.TravelDungeonSnapshot;
import features.dungeon.api.DungeonTravelMoveOutcome;
import features.dungeon.api.DungeonTravelContextModel;
import features.dungeon.api.DungeonTravelContextSnapshot;
import java.util.concurrent.atomic.AtomicLong;
import platform.state.PublishedState;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;

public final class DungeonTravelPublishedState {

    private final PublishedState<TravelDungeonSnapshot> snapshots;
    private final PublishedState<DungeonTravelContextSnapshot> contexts;
    private final TravelDungeonModel travelModel;
    private final DungeonTravelContextModel travelContextModel;
    private final AtomicLong contextSourceRevision = new AtomicLong();

    DungeonTravelPublishedState() {
        this(DirectUiDispatcher.INSTANCE);
    }

    public DungeonTravelPublishedState(UiDispatcher dispatcher) {
        snapshots = new PublishedState<>(TravelDungeonSnapshot.empty(), dispatcher);
        contexts = new PublishedState<>(DungeonTravelContextSnapshot.empty(0L, 0L), dispatcher);
        travelModel = new TravelDungeonModel(snapshots::current, snapshots::subscribe);
        travelContextModel = new DungeonTravelContextModel(contexts::current, contexts::subscribe);
    }

    public TravelDungeonModel travelModel() {
        return travelModel;
    }

    public DungeonTravelContextModel travelContextModel() {
        return travelContextModel;
    }

    void publish(
            TravelDungeonSessionSnapshot.SnapshotData snapshot,
            DungeonTravelMoveOutcome moveOutcome,
            long partyPositionRevision
    ) {
        TravelDungeonSnapshot detailed = DungeonTravelPublishedProjection.snapshot(
                snapshot, moveOutcome, partyPositionRevision);
        snapshots.publish(detailed);
        contexts.publish(DungeonTravelPublishedProjection.context(
                detailed,
                contextSourceRevision.incrementAndGet(),
                partyPositionRevision));
    }
}
