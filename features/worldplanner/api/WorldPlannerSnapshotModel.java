package features.worldplanner.api;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class WorldPlannerSnapshotModel {

    private final Supplier<WorldPlannerSnapshot> currentSupplier;
    private final Function<Consumer<WorldPlannerSnapshot>, Runnable> subscribeAction;
    private final Function<Consumer<WorldPlannerSnapshot>, Runnable> observeLatestAction;
    public WorldPlannerSnapshotModel(
            Supplier<WorldPlannerSnapshot> currentSupplier,
            Function<Consumer<WorldPlannerSnapshot>, Runnable> subscribeAction
    ) {
        this(currentSupplier, subscribeAction, unsupportedAtomicObservation());
    }

    public WorldPlannerSnapshotModel(
            Supplier<WorldPlannerSnapshot> currentSupplier,
            Function<Consumer<WorldPlannerSnapshot>, Runnable> subscribeAction,
            Function<Consumer<WorldPlannerSnapshot>, Runnable> observeLatestAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? WorldPlannerSnapshotModel::emptySnapshot
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
        this.observeLatestAction = Objects.requireNonNull(observeLatestAction, "observeLatestAction");
    }

    public Runnable observeLatest(Consumer<WorldPlannerSnapshot> observer) {
        return Objects.requireNonNull(observeLatestAction.apply(Objects.requireNonNull(observer, "observer")),
                "unsubscribe");
    }

    private static Function<Consumer<WorldPlannerSnapshot>, Runnable> unsupportedAtomicObservation() {
        return ignored -> { throw new IllegalStateException("Atomic world observation is not configured."); };
    }

    public WorldPlannerSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<WorldPlannerSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    private static WorldPlannerSnapshot emptySnapshot() {
        return new WorldPlannerSnapshot(WorldPlannerReadStatus.STORAGE_ERROR, List.of(), List.of(), List.of(), "");
    }

}
