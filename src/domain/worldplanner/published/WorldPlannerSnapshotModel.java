package src.domain.worldplanner.published;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import platform.ui.UiDispatcher;
import src.domain.shared.published.PublishedState;

public final class WorldPlannerSnapshotModel {

    private final Supplier<WorldPlannerSnapshot> currentSupplier;
    private final Function<Consumer<WorldPlannerSnapshot>, Runnable> subscribeAction;
    private PublishedState<WorldPlannerSnapshot> statefulStore;

    public WorldPlannerSnapshotModel() {
        this(new PublishedState<>(initialSnapshot()));
    }

    public WorldPlannerSnapshotModel(UiDispatcher dispatcher) {
        this(new PublishedState<>(initialSnapshot(), dispatcher));
    }

    private WorldPlannerSnapshotModel(PublishedState<WorldPlannerSnapshot> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public WorldPlannerSnapshotModel(
            Supplier<WorldPlannerSnapshot> currentSupplier,
            Function<Consumer<WorldPlannerSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? WorldPlannerSnapshotModel::emptySnapshot
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public WorldPlannerSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<WorldPlannerSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public void publish(WorldPlannerSnapshot snapshot) {
        if (statefulStore != null) {
            statefulStore.publish(snapshot == null ? initialSnapshot() : snapshot);
        }
    }

    public void publishStorageError(String message) {
        if (statefulStore != null) {
            WorldPlannerSnapshot current = statefulStore.current();
            statefulStore.publish(new WorldPlannerSnapshot(
                    WorldPlannerReadStatus.STORAGE_ERROR,
                    current.npcs(),
                    current.factions(),
                    current.locations(),
                    message == null || message.isBlank()
                            ? "World Planner konnte nicht geladen werden."
                            : message));
        }
    }

    private static WorldPlannerSnapshot emptySnapshot() {
        return new WorldPlannerSnapshot(WorldPlannerReadStatus.STORAGE_ERROR, List.of(), List.of(), List.of(), "");
    }

    private static WorldPlannerSnapshot initialSnapshot() {
        return new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS,
                List.of(),
                List.of(),
                List.of(),
                "");
    }
}
