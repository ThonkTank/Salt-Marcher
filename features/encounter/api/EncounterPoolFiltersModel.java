package features.encounter.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

/** Read-only projection of Encounter-owned generation pool filters. */
public final class EncounterPoolFiltersModel {

    private final Supplier<EncounterPoolFilters> currentSupplier;
    private final Function<Consumer<EncounterPoolFilters>, Runnable> subscribeAction;

    public EncounterPoolFiltersModel(
            Supplier<EncounterPoolFilters> currentSupplier,
            Function<Consumer<EncounterPoolFilters>, Runnable> subscribeAction
    ) {
        this.currentSupplier = Objects.requireNonNull(currentSupplier, "currentSupplier");
        this.subscribeAction = Objects.requireNonNull(subscribeAction, "subscribeAction");
    }

    public EncounterPoolFilters current() {
        return Objects.requireNonNull(currentSupplier.get(), "current pool filters");
    }

    public Runnable subscribe(Consumer<EncounterPoolFilters> listener) {
        return Objects.requireNonNull(
                subscribeAction.apply(Objects.requireNonNull(listener, "listener")),
                "unsubscribe");
    }
}
