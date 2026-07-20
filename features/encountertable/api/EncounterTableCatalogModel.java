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
            Function<Consumer<EncounterTableCatalogResult>, Runnable> subscribeAction,
            Function<Consumer<EncounterTableCatalogResult>, Runnable> observeLatestAction
    ) {
        this.currentSupplier = Objects.requireNonNull(currentSupplier, "currentSupplier");
        this.subscribeAction = Objects.requireNonNull(subscribeAction, "subscribeAction");
        this.observeLatestAction = Objects.requireNonNull(observeLatestAction, "observeLatestAction");
    }

    public Runnable observeLatest(Consumer<EncounterTableCatalogResult> observer) {
        return Objects.requireNonNull(observeLatestAction.apply(Objects.requireNonNull(observer, "observer")),
                "unsubscribe");
    }

    public EncounterTableCatalogResult current() {
        return Objects.requireNonNull(currentSupplier.get(), "current encounter tables");
    }

    public Runnable subscribe(Consumer<EncounterTableCatalogResult> listener) {
        return Objects.requireNonNull(
                subscribeAction.apply(Objects.requireNonNull(listener, "listener")), "unsubscribe");
    }
}
