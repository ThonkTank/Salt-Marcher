package features.worldplanner.api;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class WorldPlannerSnapshotModel {

    private final Supplier<WorldPlannerSnapshot> currentSupplier;
    private final Function<Consumer<WorldPlannerSnapshot>, Runnable> subscribeAction;
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

    private static WorldPlannerSnapshot emptySnapshot() {
        return new WorldPlannerSnapshot(WorldPlannerReadStatus.STORAGE_ERROR, List.of(), List.of(), List.of(), "");
    }

}
