package features.encountertable.api;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import platform.ui.UiDispatcher;
import platform.state.PublishedState;

public final class EncounterTableCandidatesModel {

    private final Supplier<EncounterTableCandidatesResult> currentSupplier;
    private final Function<Consumer<EncounterTableCandidatesResult>, Runnable> subscribeAction;
    private PublishedState<EncounterTableCandidatesResult> statefulStore;

    public EncounterTableCandidatesModel() {
        this(new PublishedState<>(emptyResult()));
    }

    public EncounterTableCandidatesModel(UiDispatcher dispatcher) {
        this(new PublishedState<>(emptyResult(), dispatcher));
    }

    private EncounterTableCandidatesModel(PublishedState<EncounterTableCandidatesResult> store) {
        this(store::current, store::subscribe);
        statefulStore = store;
    }

    public EncounterTableCandidatesModel(
            Supplier<EncounterTableCandidatesResult> currentSupplier,
            Function<Consumer<EncounterTableCandidatesResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? EncounterTableCandidatesModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public EncounterTableCandidatesResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<EncounterTableCandidatesResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    public void publish(EncounterTableCandidatesResult result) {
        if (statefulStore != null) {
            statefulStore.publish(result == null ? emptyResult() : result);
        }
    }

    private static EncounterTableCandidatesResult emptyResult() {
        return new EncounterTableCandidatesResult(EncounterTableReadStatus.STORAGE_ERROR, List.of());
    }
}
