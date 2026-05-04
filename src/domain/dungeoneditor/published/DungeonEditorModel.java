package src.domain.dungeoneditor.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public record DungeonEditorModel(
        Supplier<DungeonEditorSnapshot> currentSupplier,
        Function<Consumer<DungeonEditorSnapshot>, Runnable> subscribeAction
) {

    public DungeonEditorModel {
        currentSupplier = currentSupplier == null
                ? () -> DungeonEditorSnapshot.empty("")
                : currentSupplier;
        subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public DungeonEditorSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<DungeonEditorSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
