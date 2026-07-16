package features.party.api;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class ActivePartyCompositionModel {

    private final Supplier<ActivePartyCompositionResult> currentSupplier;
    private final Function<Consumer<ActivePartyCompositionResult>, Runnable> subscribeAction;
    public ActivePartyCompositionModel(
            Supplier<ActivePartyCompositionResult> currentSupplier,
            Function<Consumer<ActivePartyCompositionResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? ActivePartyCompositionModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public ActivePartyCompositionResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<ActivePartyCompositionResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    private static ActivePartyCompositionResult emptyResult() {
        return new ActivePartyCompositionResult(
                ReadStatus.STORAGE_ERROR,
                new ActivePartyComposition(List.of(), 1));
    }
}
