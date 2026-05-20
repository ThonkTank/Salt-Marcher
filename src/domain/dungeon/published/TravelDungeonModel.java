package src.domain.dungeon.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class TravelDungeonModel {

    private final Supplier<?> currentSupplier;

    public TravelDungeonModel(Supplier<?> currentSupplier) {
        this.currentSupplier = currentSupplier == null
                ? TravelDungeonSnapshot::empty
                : currentSupplier;
    }

    public TravelDungeonSnapshot current() {
        return TravelDungeonSnapshot.fromSessionSnapshot(currentSupplier.get());
    }

    public Runnable subscribe(Consumer<TravelDungeonSnapshot> listener) {
        Objects.requireNonNull(listener, "listener");
        return () -> { };
    }
}
