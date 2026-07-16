package features.creatures.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import platform.ui.UiDispatcher;
import platform.state.PublishedState;

public final class CreatureCatalogModel {

    private final Supplier<CreatureCatalogPageResult> currentSupplier;
    private final Function<Consumer<CreatureCatalogPageResult>, Runnable> subscribeAction;
    private PublishedState<CreatureCatalogPageResult> statefulStore;

    public CreatureCatalogModel() {
        this(new PublishedState<>(emptyResult()));
    }

    public CreatureCatalogModel(UiDispatcher dispatcher) {
        this(new PublishedState<>(emptyResult(), dispatcher));
    }

    private CreatureCatalogModel(PublishedState<CreatureCatalogPageResult> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

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

    public void publish(CreatureCatalogPageResult result) {
        if (statefulStore != null) {
            statefulStore.publish(result == null ? emptyResult() : result);
        }
    }

    private static CreatureCatalogPageResult emptyResult() {
        return new CreatureCatalogPageResult(
                CreatureQueryStatus.STORAGE_ERROR,
                CreatureCatalogPage.empty(50, 0));
    }
}
