package features.encountertable.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class EncounterTableCatalogModel {

    private final Supplier<EncounterTableCatalogResult> currentSupplier;
    private final Function<Consumer<EncounterTableCatalogResult>, Runnable> subscribeAction;
    private final Function<Consumer<EncounterTableCatalogResult>, Runnable> observeLatestAction;
    public EncounterTableCatalogModel(
            Supplier<EncounterTableCatalogResult> currentSupplier,
            Function<Consumer<EncounterTableCatalogResult>, Runnable> subscribeAction
    ) {
        this(currentSupplier, subscribeAction, unsupportedAtomicObservation());
    }

    public EncounterTableCatalogModel(
            Supplier<EncounterTableCatalogResult> currentSupplier,
            Function<Consumer<EncounterTableCatalogResult>, Runnable> subscribeAction,
            Function<Consumer<EncounterTableCatalogResult>, Runnable> observeLatestAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? EncounterTableCatalogModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
        this.observeLatestAction = Objects.requireNonNull(observeLatestAction, "observeLatestAction");
    }

    public Runnable observeLatest(Consumer<EncounterTableCatalogResult> observer) {
        return Objects.requireNonNull(observeLatestAction.apply(Objects.requireNonNull(observer, "observer")),
                "unsubscribe");
    }

    private static Function<Consumer<EncounterTableCatalogResult>, Runnable> unsupportedAtomicObservation() {
        return ignored -> { throw new IllegalStateException("Atomic table observation is not configured."); };
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
