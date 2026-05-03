package src.domain.encountertable.published;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public record EncounterTableCatalogModel(
        Supplier<EncounterTableCatalogResult> currentSupplier,
        Function<Consumer<EncounterTableCatalogResult>, Runnable> subscribeAction
) {

    public EncounterTableCatalogModel {
        currentSupplier = currentSupplier == null
                ? () -> new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, List.of())
                : currentSupplier;
        subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public EncounterTableCatalogResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<EncounterTableCatalogResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
