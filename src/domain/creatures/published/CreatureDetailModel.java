package src.domain.creatures.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import platform.ui.UiDispatcher;
import src.domain.shared.published.PublishedState;

public final class CreatureDetailModel {

    private final Supplier<CreatureDetailResult> currentSupplier;
    private final Function<Consumer<CreatureDetailResult>, Runnable> subscribeAction;
    private PublishedState<CreatureDetailResult> statefulStore;

    public CreatureDetailModel() {
        this(new PublishedState<>(emptyResult()));
    }

    public CreatureDetailModel(UiDispatcher dispatcher) {
        this(new PublishedState<>(emptyResult(), dispatcher));
    }

    private CreatureDetailModel(PublishedState<CreatureDetailResult> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

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

    public void publish(CreatureDetailResult result) {
        if (statefulStore != null) {
            statefulStore.publish(result == null ? emptyResult() : result);
        }
    }

    private static CreatureDetailResult emptyResult() {
        return new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null);
    }
}
