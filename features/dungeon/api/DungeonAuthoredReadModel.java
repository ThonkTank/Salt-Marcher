package features.dungeon.api;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class DungeonAuthoredReadModel {

    private final Supplier<DungeonAuthoredReadResult> currentSupplier;
    private final Function<Consumer<DungeonAuthoredReadResult>, Runnable> subscribeAction;

    public DungeonAuthoredReadModel(
            Supplier<DungeonAuthoredReadResult> currentSupplier,
            Function<Consumer<DungeonAuthoredReadResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? DungeonAuthoredReadModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public DungeonAuthoredReadResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<DungeonAuthoredReadResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    private static DungeonAuthoredReadResult emptyResult() {
        return new DungeonAuthoredReadResult.CommittedSnapshot(new DungeonSnapshot(
                "Dungeon",
                DungeonMapMode.EDITOR,
                DungeonMapSnapshot.empty(),
                List.of(),
                List.of(),
                0));
    }
}
