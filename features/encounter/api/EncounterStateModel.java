package features.encounter.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class EncounterStateModel {

    private final Supplier<EncounterStateSnapshot> currentSupplier;
    private final Function<Consumer<EncounterStateSnapshot>, Runnable> subscribeAction;

    public EncounterStateModel(
            Supplier<EncounterStateSnapshot> currentSupplier,
            Function<Consumer<EncounterStateSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> EncounterStateSnapshot.empty("Encounter state is not registered.")
                : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public EncounterStateSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<EncounterStateSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
