package features.dungeon.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class DungeonEditorStateModel {
    private final Supplier<DungeonEditorStateSnapshot> currentSupplier;
    private final Function<Consumer<DungeonEditorStateSnapshot>, Runnable> subscribeAction;

    public DungeonEditorStateModel(
            Supplier<DungeonEditorStateSnapshot> currentSupplier,
            Function<Consumer<DungeonEditorStateSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> DungeonEditorStateSnapshot.empty("")
                : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public DungeonEditorStateSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<DungeonEditorStateSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
