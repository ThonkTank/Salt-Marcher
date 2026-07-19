package features.travel.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class TravelContextModel {

    private final Supplier<TravelContextSnapshot> currentSupplier;
    private final Function<Consumer<TravelContextSnapshot>, Runnable> subscribeAction;

    public TravelContextModel(
            Supplier<TravelContextSnapshot> currentSupplier,
            Function<Consumer<TravelContextSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> TravelContextSnapshot.none(0L)
                : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public TravelContextSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<TravelContextSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
