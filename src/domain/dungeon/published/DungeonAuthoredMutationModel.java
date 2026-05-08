package src.domain.dungeon.published;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class DungeonAuthoredMutationModel {

    private final Supplier<DungeonAuthoredMutationResult> currentSupplier;
    private final Function<Consumer<DungeonAuthoredMutationResult>, Runnable> subscribeAction;

    public DungeonAuthoredMutationModel(
            Supplier<DungeonAuthoredMutationResult> currentSupplier,
            Function<Consumer<DungeonAuthoredMutationResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? DungeonAuthoredMutationModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public DungeonAuthoredMutationResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<DungeonAuthoredMutationResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    private static DungeonAuthoredMutationResult emptyResult() {
        return new DungeonAuthoredMutationResult.Operation(new DungeonOperationResult(
                new DungeonSnapshot(
                        "Dungeon",
                        DungeonMapMode.EDITOR,
                        DungeonMapSnapshot.empty(),
                        List.of(),
                        List.of(),
                        0),
                List.of(),
                List.of()));
    }
}
