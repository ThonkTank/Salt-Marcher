package features.party.api;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class ActivePartyFactsModel {

    private final Supplier<ActivePartyFactsResult> currentSupplier;
    private final Function<Consumer<ActivePartyFactsResult>, Runnable> subscribeAction;

    public ActivePartyFactsModel(
            Supplier<ActivePartyFactsResult> currentSupplier,
            Function<Consumer<ActivePartyFactsResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? ActivePartyFactsModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public ActivePartyFactsResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<ActivePartyFactsResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    private static ActivePartyFactsResult emptyResult() {
        return new ActivePartyFactsResult(
                ReadStatus.STORAGE_ERROR,
                new ActivePartyFacts(
                        0L,
                        List.of(),
                        new ActivePartyComposition(List.of(), null),
                        new AdventuringDaySummary(List.of(), 0, 0, 0, 0, 0, List.of())));
    }
}
