package src.domain.dungeon.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class TravelDungeonModel {

    private final Supplier<TravelDungeonSnapshot> currentSupplier;
    private final Function<Consumer<TravelDungeonSnapshot>, Runnable> subscribeAction;

    public TravelDungeonModel(
            Supplier<TravelDungeonSnapshot> currentSupplier,
            Function<Consumer<TravelDungeonSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? TravelDungeonSnapshot::empty
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public TravelDungeonSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<TravelDungeonSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
