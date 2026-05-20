package src.domain.dungeon.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class DungeonEditorControlsModel {
    private final Supplier<DungeonEditorControlsSnapshot> currentSupplier;
    private final Function<Consumer<DungeonEditorControlsSnapshot>, Runnable> subscribeAction;

    public DungeonEditorControlsModel(
            Supplier<DungeonEditorControlsSnapshot> currentSupplier,
            Function<Consumer<DungeonEditorControlsSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> DungeonEditorControlsSnapshot.empty("")
                : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public DungeonEditorControlsSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<DungeonEditorControlsSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
