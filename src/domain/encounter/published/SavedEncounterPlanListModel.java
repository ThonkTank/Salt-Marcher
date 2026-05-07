package src.domain.encounter.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public record SavedEncounterPlanListModel(
        Supplier<SavedEncounterPlanListResult> currentSupplier,
        Function<Consumer<SavedEncounterPlanListResult>, Runnable> subscribeAction
) {

    public SavedEncounterPlanListModel {
        currentSupplier = currentSupplier == null
                ? () -> new SavedEncounterPlanListResult(
                        SavedEncounterPlanStatus.STORAGE_ERROR,
                        java.util.List.of(),
                        "")
                : currentSupplier;
        subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public SavedEncounterPlanListResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SavedEncounterPlanListResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
