package features.hex.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class HexTravelModel {

    private final Supplier<HexTravelSnapshot> currentSupplier;
    private final Function<Consumer<HexTravelSnapshot>, Runnable> subscribeAction;
    public HexTravelModel(
            Supplier<HexTravelSnapshot> currentSupplier,
            Function<Consumer<HexTravelSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> HexTravelSnapshot.empty("Hex travel readback is not registered.")
                : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public HexTravelSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<HexTravelSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

}
