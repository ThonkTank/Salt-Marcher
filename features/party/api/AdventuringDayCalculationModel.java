package features.party.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import platform.ui.UiDispatcher;
import platform.state.PublishedState;

public final class AdventuringDayCalculationModel {

    private final Supplier<AdventuringDayCalculationResult> currentSupplier;
    private final Function<Consumer<AdventuringDayCalculationResult>, Runnable> subscribeAction;
    private PublishedState<AdventuringDayCalculationResult> statefulStore;

    public AdventuringDayCalculationModel() {
        this(new PublishedState<>(emptyResult()));
    }

    public AdventuringDayCalculationModel(UiDispatcher dispatcher) {
        this(new PublishedState<>(emptyResult(), dispatcher));
    }

    private AdventuringDayCalculationModel(PublishedState<AdventuringDayCalculationResult> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public AdventuringDayCalculationModel(
            Supplier<AdventuringDayCalculationResult> currentSupplier,
            Function<Consumer<AdventuringDayCalculationResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? AdventuringDayCalculationModel::emptyResult
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

    public void publish(AdventuringDayCalculationResult result) {
        if (statefulStore != null) {
            statefulStore.publish(result == null ? emptyResult() : result);
        }
    }

    private static AdventuringDayCalculationResult emptyResult() {
        return new AdventuringDayCalculationResult(
                ReadStatus.STORAGE_ERROR,
                new AdventuringDayCalculation(
                        new AdventuringDayBudget(0, 0, 0, 0, 0),
                        new AdventuringDayProgress(0, 0, 0, 0, 0.0, 0, 0, java.util.List.of(), java.util.List.of())),
                AdventuringDayPlanningSummary.empty());
    }
}
