package features.party.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class PartyTravelPositionsModel {

    private final Supplier<PartyTravelPositionsResult> currentSupplier;
    private final Function<Consumer<PartyTravelPositionsResult>, Runnable> subscribeAction;
    public PartyTravelPositionsModel(
            Supplier<PartyTravelPositionsResult> currentSupplier,
            Function<Consumer<PartyTravelPositionsResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? PartyTravelPositionsModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public PartyTravelPositionsResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<PartyTravelPositionsResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    private static PartyTravelPositionsResult emptyResult() {
        return new PartyTravelPositionsResult(ReadStatus.STORAGE_ERROR, java.util.List.of(), null);
    }
}
