package src.domain.encounter.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public record EncounterPlanBudgetModel(
        Supplier<EncounterPlanBudgetResult> currentSupplier,
        Function<Consumer<EncounterPlanBudgetResult>, Runnable> subscribeAction
) {

    public EncounterPlanBudgetModel {
        currentSupplier = currentSupplier == null
                ? () -> new EncounterPlanBudgetResult(
                        EncounterPlanBudgetStatus.STORAGE_ERROR,
                        null,
                        "")
                : currentSupplier;
        subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public EncounterPlanBudgetResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<EncounterPlanBudgetResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
