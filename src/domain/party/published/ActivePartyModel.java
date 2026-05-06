package src.domain.party.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class ActivePartyModel {

    private final Supplier<ActivePartyResult> currentSupplier;
    private final Function<Consumer<ActivePartyResult>, Runnable> subscribeAction;

    public ActivePartyModel(
            Supplier<ActivePartyResult> currentSupplier,
            Function<Consumer<ActivePartyResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> new ActivePartyResult(ReadStatus.STORAGE_ERROR, java.util.List.of())
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public ActivePartyResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<ActivePartyResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
