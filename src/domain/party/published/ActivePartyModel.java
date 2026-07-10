package src.domain.party.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import src.domain.shared.published.PublishedState;

public final class ActivePartyModel {

    private final Supplier<ActivePartyResult> currentSupplier;
    private final Function<Consumer<ActivePartyResult>, Runnable> subscribeAction;
    private PublishedState<ActivePartyResult> statefulStore;

    public ActivePartyModel() {
        this(new PublishedState<>(emptyResult()));
    }

    private ActivePartyModel(PublishedState<ActivePartyResult> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public ActivePartyModel(
            Supplier<ActivePartyResult> currentSupplier,
            Function<Consumer<ActivePartyResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? ActivePartyModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public ActivePartyResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<ActivePartyResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public void publish(ActivePartyResult result) {
        if (statefulStore != null) {
            statefulStore.publish(result == null ? emptyResult() : result);
        }
    }

    public void replace(ActivePartyResult result) {
        if (statefulStore != null) {
            statefulStore.replace(result == null ? emptyResult() : result);
        }
    }

    private static ActivePartyResult emptyResult() {
        return new ActivePartyResult(ReadStatus.STORAGE_ERROR, java.util.List.of());
    }
}
