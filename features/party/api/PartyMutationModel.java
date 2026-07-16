package features.party.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import platform.ui.UiDispatcher;
import platform.state.PublishedState;

public final class PartyMutationModel {

    private final Supplier<MutationResult> currentSupplier;
    private final Function<Consumer<MutationResult>, Runnable> subscribeAction;
    private PublishedState<MutationResult> statefulStore;

    public PartyMutationModel() {
        this(new PublishedState<>(emptyResult()));
    }

    public PartyMutationModel(UiDispatcher dispatcher) {
        this(new PublishedState<>(emptyResult(), dispatcher));
    }

    private PartyMutationModel(PublishedState<MutationResult> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public PartyMutationModel(
            Supplier<MutationResult> currentSupplier,
            Function<Consumer<MutationResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? PartyMutationModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public MutationResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<MutationResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public void publish(MutationResult result) {
        if (statefulStore != null) {
            statefulStore.publish(result == null ? emptyResult() : result);
        }
    }

    private static MutationResult emptyResult() {
        return new MutationResult(MutationStatus.SUCCESS);
    }
}
