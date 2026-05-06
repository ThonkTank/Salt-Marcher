package src.domain.sessionplanner.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class SessionPlannerModel {

    private final Supplier<SessionPlannerSnapshot> currentSupplier;
    private final Function<Consumer<SessionPlannerSnapshot>, Runnable> subscribeAction;

    public SessionPlannerModel(
            Supplier<SessionPlannerSnapshot> currentSupplier,
            Function<Consumer<SessionPlannerSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> SessionPlannerSnapshot.empty("Session planner service is not registered.")
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public SessionPlannerSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SessionPlannerSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
