package src.domain.party.published;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import platform.ui.UiDispatcher;
import src.domain.shared.published.PublishedState;

public final class PartySnapshotModel {

    private final Supplier<PartySnapshotResult> currentSupplier;
    private final Function<Consumer<PartySnapshotResult>, Runnable> subscribeAction;
    private PublishedState<PartySnapshotResult> statefulStore;

    public PartySnapshotModel() {
        this(new PublishedState<>(emptyResult()));
    }

    public PartySnapshotModel(UiDispatcher dispatcher) {
        this(new PublishedState<>(emptyResult(), dispatcher));
    }

    private PartySnapshotModel(PublishedState<PartySnapshotResult> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public PartySnapshotModel(
            Supplier<PartySnapshotResult> currentSupplier,
            Function<Consumer<PartySnapshotResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? PartySnapshotModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public PartySnapshotResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<PartySnapshotResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public void publish(PartySnapshotResult result) {
        if (statefulStore != null) {
            statefulStore.publish(result == null ? emptyResult() : result);
        }
    }

    public void replace(PartySnapshotResult result) {
        if (statefulStore != null) {
            statefulStore.replace(result == null ? emptyResult() : result);
        }
    }

    private static PartySnapshotResult emptyResult() {
        return new PartySnapshotResult(
                ReadStatus.STORAGE_ERROR,
                new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1)));
    }
}
