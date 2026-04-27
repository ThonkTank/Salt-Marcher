package src.domain.encounter.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public record EncounterSessionModel(
        Supplier<EncounterSessionSnapshot> currentSupplier,
        Function<Consumer<EncounterSessionSnapshot>, Runnable> subscribeAction
) {

    public EncounterSessionModel {
        currentSupplier = currentSupplier == null
                ? () -> EncounterSessionSnapshot.empty("Encounter session is not registered.")
                : currentSupplier;
        subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public EncounterSessionSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<EncounterSessionSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
