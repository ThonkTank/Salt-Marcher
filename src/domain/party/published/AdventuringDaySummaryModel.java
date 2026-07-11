package src.domain.party.published;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import src.domain.shared.published.PublishedState;

public final class AdventuringDaySummaryModel {

    private final Supplier<AdventuringDayResult> currentSupplier;
    private final Function<Consumer<AdventuringDayResult>, Runnable> subscribeAction;
    private PublishedState<AdventuringDayResult> statefulStore;

    public AdventuringDaySummaryModel() {
        this(new PublishedState<>(emptyResult()));
    }

    private AdventuringDaySummaryModel(PublishedState<AdventuringDayResult> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public AdventuringDaySummaryModel(
            Supplier<AdventuringDayResult> currentSupplier,
            Function<Consumer<AdventuringDayResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? AdventuringDaySummaryModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public AdventuringDayResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<AdventuringDayResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public void publish(AdventuringDayResult result) {
        if (statefulStore != null) {
            statefulStore.publish(result == null ? emptyResult() : result);
        }
    }

    public void replace(AdventuringDayResult result) {
        if (statefulStore != null) {
            statefulStore.replace(result == null ? emptyResult() : result);
        }
    }

    private static AdventuringDayResult emptyResult() {
        return new AdventuringDayResult(
                ReadStatus.STORAGE_ERROR,
                new AdventuringDaySummary(List.of(), 0, 0, 0, 0, 0, List.of()));
    }
}
