package src.domain.party.published;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import src.domain.shared.published.PublishedState;

public final class ActivePartyCompositionModel {

    private final Supplier<ActivePartyCompositionResult> currentSupplier;
    private final Function<Consumer<ActivePartyCompositionResult>, Runnable> subscribeAction;
    private PublishedState<ActivePartyCompositionResult> statefulStore;

    public ActivePartyCompositionModel() {
        this(new PublishedState<>(emptyResult()));
    }

    private ActivePartyCompositionModel(PublishedState<ActivePartyCompositionResult> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public ActivePartyCompositionModel(
            Supplier<ActivePartyCompositionResult> currentSupplier,
            Function<Consumer<ActivePartyCompositionResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? ActivePartyCompositionModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public ActivePartyCompositionResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<ActivePartyCompositionResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public void publish(ActivePartyCompositionResult result) {
        if (statefulStore != null) {
            statefulStore.publish(result == null ? emptyResult() : result);
        }
    }

    public void replace(ActivePartyCompositionResult result) {
        if (statefulStore != null) {
            statefulStore.replace(result == null ? emptyResult() : result);
        }
    }

    private static ActivePartyCompositionResult emptyResult() {
        return new ActivePartyCompositionResult(
                ReadStatus.STORAGE_ERROR,
                new ActivePartyComposition(List.of(), 1));
    }
}
