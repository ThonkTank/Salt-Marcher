package src.domain.creatures.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public record CreatureFilterOptionsModel(
        Supplier<CreatureFilterOptionsResult> currentSupplier,
        Function<Consumer<CreatureFilterOptionsResult>, Runnable> subscribeAction
) {

    public CreatureFilterOptionsModel {
        currentSupplier = currentSupplier == null
                ? () -> new CreatureFilterOptionsResult(CreatureReadStatus.STORAGE_ERROR, CreatureFilterOptions.empty())
                : currentSupplier;
        subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public CreatureFilterOptionsResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<CreatureFilterOptionsResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
