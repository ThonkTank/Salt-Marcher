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
            Function<Consumer<SavedEncounterPlanListResult>, Runnable> subscribeAction,
            Function<Consumer<SavedEncounterPlanListResult>, Runnable> observeLatestAction
    ) {
        this.currentSupplier = Objects.requireNonNull(currentSupplier, "currentSupplier");
        this.subscribeAction = Objects.requireNonNull(subscribeAction, "subscribeAction");
        this.observeLatestAction = Objects.requireNonNull(observeLatestAction, "observeLatestAction");
    }

    public SavedEncounterPlanListResult current() {
        return Objects.requireNonNull(currentSupplier.get(), "current saved plans");
    }

    public Runnable subscribe(Consumer<SavedEncounterPlanListResult> listener) {
        return Objects.requireNonNull(
                subscribeAction.apply(Objects.requireNonNull(listener, "listener")), "unsubscribe");
    }

    public Runnable observeLatest(Consumer<SavedEncounterPlanListResult> observer) {
        return Objects.requireNonNull(observeLatestAction.apply(Objects.requireNonNull(observer, "observer")),
                "unsubscribe");
    }

}
