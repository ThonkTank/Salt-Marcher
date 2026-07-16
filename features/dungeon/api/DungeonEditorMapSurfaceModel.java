package features.dungeon.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class DungeonEditorMapSurfaceModel {
    private final Supplier<DungeonEditorMapSurfaceSnapshot> currentSupplier;
    private final Function<Consumer<DungeonEditorMapSurfaceSnapshot>, Runnable> subscribeAction;

    public DungeonEditorMapSurfaceModel(
            Supplier<DungeonEditorMapSurfaceSnapshot> currentSupplier,
            Function<Consumer<DungeonEditorMapSurfaceSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? DungeonEditorMapSurfaceSnapshot::empty
                : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public DungeonEditorMapSurfaceSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<DungeonEditorMapSurfaceSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
