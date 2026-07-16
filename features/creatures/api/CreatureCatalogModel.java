package features.creatures.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class CreatureCatalogModel {

    private final Supplier<CreatureCatalogPageResult> currentSupplier;
    private final Function<Consumer<CreatureCatalogPageResult>, Runnable> subscribeAction;
    public CreatureCatalogModel(
            Supplier<CreatureCatalogPageResult> currentSupplier,
            Function<Consumer<CreatureCatalogPageResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? CreatureCatalogModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public CreatureCatalogPageResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<CreatureCatalogPageResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    private static CreatureCatalogPageResult emptyResult() {
        return new CreatureCatalogPageResult(
                CreatureQueryStatus.STORAGE_ERROR,
                CreatureCatalogPage.empty(50, 0));
    }
}
