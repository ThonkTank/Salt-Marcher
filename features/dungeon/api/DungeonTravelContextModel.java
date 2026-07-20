package features.dungeon.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class DungeonTravelContextModel {

    private final Supplier<DungeonTravelContextSnapshot> currentSupplier;
    private final Function<Consumer<DungeonTravelContextSnapshot>, Runnable> subscribeAction;

    public DungeonTravelContextModel(
            Supplier<DungeonTravelContextSnapshot> currentSupplier,
            Function<Consumer<DungeonTravelContextSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> DungeonTravelContextSnapshot.empty(0L, 0L)
                : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public DungeonTravelContextSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<DungeonTravelContextSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
