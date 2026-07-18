package features.worldplanner.api;

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
            Function<Consumer<WorldPlannerSnapshot>, Runnable> subscribeAction,
            Function<Consumer<WorldPlannerSnapshot>, Runnable> observeLatestAction
    ) {
        this.currentSupplier = Objects.requireNonNull(currentSupplier, "currentSupplier");
        this.subscribeAction = Objects.requireNonNull(subscribeAction, "subscribeAction");
        this.observeLatestAction = Objects.requireNonNull(observeLatestAction, "observeLatestAction");
    }

    public Runnable observeLatest(Consumer<WorldPlannerSnapshot> observer) {
        return Objects.requireNonNull(observeLatestAction.apply(Objects.requireNonNull(observer, "observer")),
                "unsubscribe");
    }

    public WorldPlannerSnapshot current() {
        return Objects.requireNonNull(currentSupplier.get(), "current world snapshot");
    }

    public Runnable subscribe(Consumer<WorldPlannerSnapshot> listener) {
        return Objects.requireNonNull(
                subscribeAction.apply(Objects.requireNonNull(listener, "listener")), "unsubscribe");
    }
}
