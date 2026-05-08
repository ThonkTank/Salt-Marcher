package src.domain.creatures.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class CreatureDetailModel {

    private final Supplier<CreatureDetailResult> currentSupplier;
    private final Function<Consumer<CreatureDetailResult>, Runnable> subscribeAction;

    public CreatureDetailModel(
            Supplier<CreatureDetailResult> currentSupplier,
            Function<Consumer<CreatureDetailResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? CreatureDetailModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public CreatureDetailResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<CreatureDetailResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    private static CreatureDetailResult emptyResult() {
        return new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null);
    }
}
