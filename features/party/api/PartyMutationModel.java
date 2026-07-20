package features.party.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class PartyMutationModel {

    private final Supplier<MutationResult> currentSupplier;
    private final Function<Consumer<MutationResult>, Runnable> subscribeAction;
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

    private static MutationResult emptyResult() {
        return new MutationResult(MutationStatus.SUCCESS);
    }
}
