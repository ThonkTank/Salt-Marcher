package src.domain.sessionplanner.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class SessionPlannerGenerationModel {
    private final Supplier<SessionPlannerGenerationProjection> currentSupplier;
    private final Function<Consumer<SessionPlannerGenerationProjection>, Runnable> subscribeAction;

    public SessionPlannerGenerationModel(
            Supplier<SessionPlannerGenerationProjection> currentSupplier,
            Function<Consumer<SessionPlannerGenerationProjection>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null ? SessionPlannerGenerationProjection::idle : currentSupplier;
        this.subscribeAction = subscribeAction == null ? listener -> () -> { } : subscribeAction;
    }

    public SessionPlannerGenerationProjection current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SessionPlannerGenerationProjection> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
