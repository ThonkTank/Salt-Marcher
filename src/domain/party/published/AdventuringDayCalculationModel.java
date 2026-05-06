package src.domain.party.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class AdventuringDayCalculationModel {

    private final Supplier<AdventuringDayCalculationResult> currentSupplier;
    private final Function<Consumer<AdventuringDayCalculationResult>, Runnable> subscribeAction;

    public AdventuringDayCalculationModel(
            Supplier<AdventuringDayCalculationResult> currentSupplier,
            Function<Consumer<AdventuringDayCalculationResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> new AdventuringDayCalculationResult(
                        ReadStatus.STORAGE_ERROR,
                        new AdventuringDayCalculation(
                                new AdventuringDayBudget(0, 0, 0, 0, 0),
                                new AdventuringDayProgress(0, 0, 0, 0, 0.0, 0, 0, java.util.List.of(), java.util.List.of())))
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public AdventuringDayCalculationResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<AdventuringDayCalculationResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
