package features.sessionplanner.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class SessionPreparationModel {

    private final Supplier<SessionPreparationSnapshot> currentSupplier;
    private final Function<Consumer<SessionPreparationSnapshot>, Runnable> subscribeAction;

    public SessionPreparationModel(
            Supplier<SessionPreparationSnapshot> currentSupplier,
            Function<Consumer<SessionPreparationSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = Objects.requireNonNull(currentSupplier, "currentSupplier");
        this.subscribeAction = Objects.requireNonNull(subscribeAction, "subscribeAction");
    }

    public SessionPreparationSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SessionPreparationSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
