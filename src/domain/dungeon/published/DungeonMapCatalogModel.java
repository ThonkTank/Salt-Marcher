package src.domain.dungeon.published;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class DungeonMapCatalogModel {

    private final Supplier<DungeonMapCatalogResponse> currentSupplier;
    private final Function<Consumer<DungeonMapCatalogResponse>, Runnable> subscribeAction;

    public DungeonMapCatalogModel(
            Supplier<DungeonMapCatalogResponse> currentSupplier,
            Function<Consumer<DungeonMapCatalogResponse>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? DungeonMapCatalogModel::emptyResponse
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public DungeonMapCatalogResponse current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<DungeonMapCatalogResponse> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    private static DungeonMapCatalogResponse emptyResponse() {
        return new DungeonMapCatalogResponse.MapList(List.of());
    }
}
