package features.creatures.api;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class CreatureEncounterCandidatesModel {

    private final Supplier<CreatureEncounterCandidatesResult> currentSupplier;
    private final Function<Consumer<CreatureEncounterCandidatesResult>, Runnable> subscribeAction;
    public CreatureEncounterCandidatesModel(
            Supplier<CreatureEncounterCandidatesResult> currentSupplier,
            Function<Consumer<CreatureEncounterCandidatesResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? CreatureEncounterCandidatesModel::emptyResult
                : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public CreatureEncounterCandidatesResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<CreatureEncounterCandidatesResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }

    private static CreatureEncounterCandidatesResult emptyResult() {
        return new CreatureEncounterCandidatesResult(CreatureQueryStatus.STORAGE_ERROR, List.of());
    }
}
