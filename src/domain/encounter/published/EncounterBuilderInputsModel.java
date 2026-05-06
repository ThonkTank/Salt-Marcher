package src.domain.encounter.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public record EncounterBuilderInputsModel(
        Supplier<EncounterBuilderInputs> currentSupplier,
        Function<Consumer<EncounterBuilderInputs>, Runnable> subscribeAction
) {

    public EncounterBuilderInputsModel {
        currentSupplier = currentSupplier == null ? EncounterBuilderInputs::empty : currentSupplier;
        subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public EncounterBuilderInputs current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<EncounterBuilderInputs> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
