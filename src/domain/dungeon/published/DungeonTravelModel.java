package src.domain.dungeon.published;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class DungeonTravelModel {

    private final Supplier<DungeonTravelResponse> currentSupplier;
    private final Function<Consumer<DungeonTravelResponse>, Runnable> subscribeAction;

    public DungeonTravelModel(
            Supplier<DungeonTravelResponse> currentSupplier,
            Function<Consumer<DungeonTravelResponse>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? DungeonTravelModel::emptyResponse
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public DungeonTravelResponse current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<DungeonTravelResponse> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    private static DungeonTravelResponse emptyResponse() {
        return new DungeonTravelResponse.Surface(new DungeonTravelSurfaceSnapshot(
                DungeonTravelContextKind.DUNGEON,
                "Dungeon",
                0,
                DungeonMapSnapshot.empty(),
                new DungeonTravelPosition(
                        new DungeonMapId(1L),
                        DungeonTravelLocationKind.TILE,
                        0L,
                        new DungeonCellRef(0, 0, 0),
                        DungeonTravelHeading.defaultHeading()),
                "Dungeon",
                "Kein Standort",
                "",
                "",
                "",
                "",
                List.of()));
    }
}
