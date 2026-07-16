package features.encountertable.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class EncounterTableCandidatesModel {

    private final Supplier<EncounterTableCandidatesResult> currentSupplier;
    private final Function<Consumer<EncounterTableCandidatesResult>, Runnable> subscribeAction;
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

    private static EncounterTableCandidatesResult emptyResult() {
        return new EncounterTableCandidatesResult(EncounterTableReadStatus.STORAGE_ERROR, java.util.List.of());
    }
}
