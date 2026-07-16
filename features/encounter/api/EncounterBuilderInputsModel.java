package features.encounter.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class EncounterBuilderInputsModel {

    private final Supplier<EncounterBuilderInputs> currentSupplier;
    private final Function<Consumer<EncounterBuilderInputs>, Runnable> subscribeAction;

    public EncounterBuilderInputsModel(
            Supplier<EncounterBuilderInputs> currentSupplier,
            Function<Consumer<EncounterBuilderInputs>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null ? EncounterBuilderInputs::empty : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public EncounterBuilderInputs current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<EncounterBuilderInputs> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
