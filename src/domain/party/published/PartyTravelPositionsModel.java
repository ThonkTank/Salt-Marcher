package src.domain.party.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public record PartyTravelPositionsModel(
        Supplier<PartyTravelPositionsResult> currentSupplier,
        Function<Consumer<PartyTravelPositionsResult>, Runnable> subscribeAction
) {

    public PartyTravelPositionsModel {
        currentSupplier = currentSupplier == null
                ? () -> new PartyTravelPositionsResult(ReadStatus.STORAGE_ERROR, java.util.List.of(), null)
                : currentSupplier;
        subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public PartyTravelPositionsResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<PartyTravelPositionsResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
