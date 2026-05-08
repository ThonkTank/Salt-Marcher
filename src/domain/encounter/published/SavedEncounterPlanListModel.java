package src.domain.encounter.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class SavedEncounterPlanListModel {

    private final Supplier<SavedEncounterPlanListResult> currentSupplier;
    private final Function<Consumer<SavedEncounterPlanListResult>, Runnable> subscribeAction;

    public SavedEncounterPlanListModel(
            Supplier<SavedEncounterPlanListResult> currentSupplier,
            Function<Consumer<SavedEncounterPlanListResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> new SavedEncounterPlanListResult(
                        SavedEncounterPlanStatus.STORAGE_ERROR,
                        java.util.List.of(),
                        "")
                : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public SavedEncounterPlanListResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SavedEncounterPlanListResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
