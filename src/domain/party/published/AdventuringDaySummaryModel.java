package src.domain.party.published;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public record AdventuringDaySummaryModel(
        Supplier<AdventuringDayResult> currentSupplier,
        Function<Consumer<AdventuringDayResult>, Runnable> subscribeAction
) {

    public AdventuringDaySummaryModel {
        currentSupplier = currentSupplier == null
                ? AdventuringDaySummaryModel::emptyResult
                : currentSupplier;
        subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public AdventuringDayResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<AdventuringDayResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    private static AdventuringDayResult emptyResult() {
        return new AdventuringDayResult(
                ReadStatus.STORAGE_ERROR,
                new AdventuringDaySummary(List.of(), 0, 0, 0, 0, 0, List.of()));
    }
}
