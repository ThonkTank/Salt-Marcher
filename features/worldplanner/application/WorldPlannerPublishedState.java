package features.worldplanner.application;

import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.worldplanner.domain.world.WorldPlannerState;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;

public final class WorldPlannerPublishedState {

    private static final String DEFAULT_LOAD_FAILURE = "World Planner konnte nicht geladen werden.";

    private final PublishedState<WorldPlannerSnapshot> snapshot;
    private final WorldPlannerSnapshotModel snapshotModel;

    public WorldPlannerPublishedState(UiDispatcher dispatcher) {
        snapshot = new PublishedState<>(WorldPlannerSnapshotProjection.from(WorldPlannerState.empty()), dispatcher);
        snapshotModel = new WorldPlannerSnapshotModel(snapshot::current, snapshot::subscribe);
    }

    public WorldPlannerSnapshotModel snapshotModel() {
        return snapshotModel;
    }

    public void publish(WorldPlannerSnapshot nextSnapshot) {
        snapshot.publish(nextSnapshot == null
                ? WorldPlannerSnapshotProjection.from(WorldPlannerState.empty())
                : nextSnapshot);
    }

    public void publishStorageError(String message) {
        WorldPlannerSnapshot current = snapshot.current();
        snapshot.publish(new WorldPlannerSnapshot(
                WorldPlannerReadStatus.STORAGE_ERROR,
                current.npcs(),
                current.factions(),
                current.locations(),
                message == null || message.isBlank() ? DEFAULT_LOAD_FAILURE : message));
    }
}
