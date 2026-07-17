package features.creatures.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class CreatureReferenceIndexModel {

    private final Supplier<CreatureReferenceIndexResult> currentSupplier;
    private final Function<Consumer<CreatureReferenceIndexResult>, Runnable> subscribeAction;

    public CreatureReferenceIndexModel(
            Supplier<CreatureReferenceIndexResult> currentSupplier,
            Function<Consumer<CreatureReferenceIndexResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? CreatureReferenceIndexModel::empty
                : currentSupplier;
        this.subscribeAction = subscribeAction == null ? ignored -> () -> { } : subscribeAction;
    }

    public CreatureReferenceIndexResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<CreatureReferenceIndexResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    private static CreatureReferenceIndexResult empty() {
        return new CreatureReferenceIndexResult(CreatureReferenceIndexStatus.LOADING, 0L, java.util.List.of());
    }
}
