package src.domain.creatures.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import src.domain.shared.published.PublishedState;

public final class CreatureFilterOptionsModel {

    private final Supplier<CreatureFilterOptionsResult> currentSupplier;
    private final Function<Consumer<CreatureFilterOptionsResult>, Runnable> subscribeAction;
    private PublishedState<CreatureFilterOptionsResult> statefulStore;

    public CreatureFilterOptionsModel() {
        this(new PublishedState<>(emptyResult()));
    }

    private CreatureFilterOptionsModel(PublishedState<CreatureFilterOptionsResult> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public CreatureFilterOptionsModel(
            Supplier<CreatureFilterOptionsResult> currentSupplier,
            Function<Consumer<CreatureFilterOptionsResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? CreatureFilterOptionsModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public CreatureFilterOptionsResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<CreatureFilterOptionsResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public void publish(CreatureFilterOptionsResult result) {
        if (statefulStore != null) {
            statefulStore.publish(result == null ? emptyResult() : result);
        }
    }

    private static CreatureFilterOptionsResult emptyResult() {
        return new CreatureFilterOptionsResult(
                CreatureReadStatus.STORAGE_ERROR,
                CreatureFilterOptions.empty());
    }
}
