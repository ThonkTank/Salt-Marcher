package src.domain.party.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public record PartyMutationModel(
        Supplier<MutationResult> currentSupplier,
        Function<Consumer<MutationResult>, Runnable> subscribeAction
) {

    public PartyMutationModel {
        currentSupplier = currentSupplier == null
                ? () -> new MutationResult(MutationStatus.SUCCESS)
                : currentSupplier;
        subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public MutationResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<MutationResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
