package features.sessionplanner.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class SessionPlannerParticipantsModel {

    private final Supplier<SessionPlannerParticipantsProjection> currentSupplier;
    private final Function<Consumer<SessionPlannerParticipantsProjection>, Runnable> subscribeAction;

    public SessionPlannerParticipantsModel(
            Supplier<SessionPlannerParticipantsProjection> currentSupplier,
            Function<Consumer<SessionPlannerParticipantsProjection>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? SessionPlannerParticipantsProjection::empty
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public SessionPlannerParticipantsProjection current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SessionPlannerParticipantsProjection> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
