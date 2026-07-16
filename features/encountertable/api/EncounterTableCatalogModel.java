package features.encountertable.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class EncounterTableCatalogModel {

    private final Supplier<EncounterTableCatalogResult> currentSupplier;
    private final Function<Consumer<EncounterTableCatalogResult>, Runnable> subscribeAction;
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

    private static EncounterTableCatalogResult emptyResult() {
        return new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, java.util.List.of());
    }
}
