package src.domain.sessionplanner.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class SessionPlannerCurrentSessionModel {

    private final Supplier<SessionPlannerSessionSnapshot> currentSupplier;
    private final Function<Consumer<SessionPlannerSessionSnapshot>, Runnable> subscribeAction;

    public SessionPlannerCurrentSessionModel(
            Supplier<SessionPlannerSessionSnapshot> currentSupplier,
            Function<Consumer<SessionPlannerSessionSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> SessionPlannerSessionSnapshot.empty("Session planner service is not registered.")
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public SessionPlannerSessionSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SessionPlannerSessionSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
