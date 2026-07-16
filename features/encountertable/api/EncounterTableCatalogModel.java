package features.encountertable.api;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import platform.ui.UiDispatcher;
import platform.state.PublishedState;

public final class EncounterTableCatalogModel {

    private final Supplier<EncounterTableCatalogResult> currentSupplier;
    private final Function<Consumer<EncounterTableCatalogResult>, Runnable> subscribeAction;
    private PublishedState<EncounterTableCatalogResult> statefulStore;

    public EncounterTableCatalogModel() {
        this(new PublishedState<>(emptyResult()));
    }

    public EncounterTableCatalogModel(UiDispatcher dispatcher) {
        this(new PublishedState<>(emptyResult(), dispatcher));
    }

    private EncounterTableCatalogModel(PublishedState<EncounterTableCatalogResult> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public EncounterTableCatalogModel(
            Supplier<EncounterTableCatalogResult> currentSupplier,
            Function<Consumer<EncounterTableCatalogResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? EncounterTableCatalogModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public EncounterTableCatalogResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<EncounterTableCatalogResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public void publish(EncounterTableCatalogResult result) {
        if (statefulStore != null) {
            statefulStore.publish(result == null ? emptyResult() : result);
        }
    }

    private static EncounterTableCatalogResult emptyResult() {
        return new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, List.of());
    }
}
