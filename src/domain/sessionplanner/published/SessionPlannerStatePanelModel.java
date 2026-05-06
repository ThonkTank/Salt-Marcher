package src.domain.sessionplanner.published;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class SessionPlannerStatePanelModel {

    private final Supplier<SessionPlannerStatePanelProjection> currentSupplier;
    private final Function<Consumer<SessionPlannerStatePanelProjection>, Runnable> subscribeAction;

    public SessionPlannerStatePanelModel(
            Supplier<SessionPlannerStatePanelProjection> currentSupplier,
            Function<Consumer<SessionPlannerStatePanelProjection>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? SessionPlannerStatePanelProjection::empty
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public SessionPlannerStatePanelProjection current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SessionPlannerStatePanelProjection> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
