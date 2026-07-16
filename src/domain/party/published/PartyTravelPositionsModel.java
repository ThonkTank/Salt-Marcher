package src.domain.party.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import platform.ui.UiDispatcher;
import src.domain.shared.published.PublishedState;

public final class PartyTravelPositionsModel {

    private final Supplier<PartyTravelPositionsResult> currentSupplier;
    private final Function<Consumer<PartyTravelPositionsResult>, Runnable> subscribeAction;
    private PublishedState<PartyTravelPositionsResult> statefulStore;

    public PartyTravelPositionsModel() {
        this(new PublishedState<>(emptyResult()));
    }

    public PartyTravelPositionsModel(UiDispatcher dispatcher) {
        this(new PublishedState<>(emptyResult(), dispatcher));
    }

    private PartyTravelPositionsModel(PublishedState<PartyTravelPositionsResult> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public PartyTravelPositionsModel(
            Supplier<PartyTravelPositionsResult> currentSupplier,
            Function<Consumer<PartyTravelPositionsResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? PartyTravelPositionsModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public PartyTravelPositionsResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<PartyTravelPositionsResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public void publish(PartyTravelPositionsResult result) {
        if (statefulStore != null) {
            statefulStore.publish(result == null ? emptyResult() : result);
        }
    }

    public void replace(PartyTravelPositionsResult result) {
        if (statefulStore != null) {
            statefulStore.replace(result == null ? emptyResult() : result);
        }
    }

    private static PartyTravelPositionsResult emptyResult() {
        return new PartyTravelPositionsResult(ReadStatus.STORAGE_ERROR, java.util.List.of(), null);
    }
}
