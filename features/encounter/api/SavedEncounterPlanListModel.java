package features.encounter.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class SavedEncounterPlanListModel {

    private final Supplier<SavedEncounterPlanListResult> currentSupplier;
    private final Function<Consumer<SavedEncounterPlanListResult>, Runnable> subscribeAction;
    private final Function<Consumer<SavedEncounterPlanListResult>, Runnable> observeLatestAction;

    public SavedEncounterPlanListModel(
            Supplier<SavedEncounterPlanListResult> currentSupplier,
            Function<Consumer<SavedEncounterPlanListResult>, Runnable> subscribeAction
    ) {
        this(currentSupplier, subscribeAction, unsupportedAtomicObservation());
    }

    public SavedEncounterPlanListModel(
            Supplier<SavedEncounterPlanListResult> currentSupplier,
            Function<Consumer<SavedEncounterPlanListResult>, Runnable> subscribeAction,
            Function<Consumer<SavedEncounterPlanListResult>, Runnable> observeLatestAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, java.util.List.of(), "")
                : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
        this.observeLatestAction = Objects.requireNonNull(observeLatestAction, "observeLatestAction");
    }

    public SavedEncounterPlanListResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SavedEncounterPlanListResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public Runnable observeLatest(Consumer<SavedEncounterPlanListResult> observer) {
        return Objects.requireNonNull(observeLatestAction.apply(Objects.requireNonNull(observer, "observer")),
                "unsubscribe");
    }

    private static Function<Consumer<SavedEncounterPlanListResult>, Runnable> unsupportedAtomicObservation() {
        return ignored -> { throw new IllegalStateException("Atomic saved-plan observation is not configured."); };
    }
}
