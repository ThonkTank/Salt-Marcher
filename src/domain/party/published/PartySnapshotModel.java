package src.domain.party.published;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class PartySnapshotModel {

    private final Supplier<PartySnapshotResult> currentSupplier;
    private final Function<Consumer<PartySnapshotResult>, Runnable> subscribeAction;

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

    private static PartySnapshotResult emptyResult() {
        return new PartySnapshotResult(
                ReadStatus.STORAGE_ERROR,
                new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1)));
    }
}
