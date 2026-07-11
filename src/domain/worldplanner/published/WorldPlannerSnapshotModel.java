package src.domain.worldplanner.published;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class WorldPlannerSnapshotModel {

    private final Supplier<WorldPlannerSnapshot> currentSupplier;
    private final Function<Consumer<WorldPlannerSnapshot>, Runnable> subscribeAction;
    private StatefulSnapshotStore statefulStore;

    public WorldPlannerSnapshotModel() {
        this(new StatefulSnapshotStore());
    }

    private WorldPlannerSnapshotModel(StatefulSnapshotStore store) {
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
            statefulStore.publish(snapshot);
        }
    }

    public void publishStorageError(String message) {
        if (statefulStore != null) {
            statefulStore.publishStorageError(message);
        }
    }

    private static WorldPlannerSnapshot emptySnapshot() {
        return new WorldPlannerSnapshot(WorldPlannerReadStatus.STORAGE_ERROR, List.of(), List.of(), List.of(), "");
    }

    private static final class StatefulSnapshotStore {

        private final List<Consumer<WorldPlannerSnapshot>> listeners = new java.util.ArrayList<>();
        private WorldPlannerSnapshot current = new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS,
                List.of(),
                List.of(),
                List.of(),
                "");

        void publish(WorldPlannerSnapshot snapshot) {
            current = snapshot == null
                    ? new WorldPlannerSnapshot(WorldPlannerReadStatus.SUCCESS, List.of(), List.of(), List.of(), "")
                    : snapshot;
            notifyListeners();
        }

        void publishStorageError(String message) {
            current = new WorldPlannerSnapshot(
                    WorldPlannerReadStatus.STORAGE_ERROR,
                    current.npcs(),
                    current.factions(),
                    current.locations(),
                    message == null || message.isBlank()
                            ? "World Planner konnte nicht geladen werden."
                            : message);
            notifyListeners();
        }

        private WorldPlannerSnapshot current() {
            return current;
        }

        private Runnable subscribe(Consumer<WorldPlannerSnapshot> listener) {
            listeners.add(listener);
            return () -> listeners.remove(listener);
        }

        private void notifyListeners() {
            for (Consumer<WorldPlannerSnapshot> listener : List.copyOf(listeners)) {
                listener.accept(current);
            }
        }
    }
}
