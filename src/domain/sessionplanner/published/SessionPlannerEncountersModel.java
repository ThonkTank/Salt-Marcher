package src.domain.sessionplanner.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class SessionPlannerEncountersModel {

    private final Supplier<SessionPlannerEncountersProjection> currentSupplier;
    private final Function<Consumer<SessionPlannerEncountersProjection>, Runnable> subscribeAction;

    public SessionPlannerEncountersModel(
            Supplier<SessionPlannerEncountersProjection> currentSupplier,
            Function<Consumer<SessionPlannerEncountersProjection>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? SessionPlannerEncountersProjection::empty
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public SessionPlannerEncountersProjection current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SessionPlannerEncountersProjection> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
