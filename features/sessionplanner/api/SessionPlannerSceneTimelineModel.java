package features.sessionplanner.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class SessionPlannerSceneTimelineModel {

    private final Supplier<SessionPlannerSceneTimelineProjection> currentSupplier;
    private final Function<Consumer<SessionPlannerSceneTimelineProjection>, Runnable> subscribeAction;

    public SessionPlannerSceneTimelineModel(
            Supplier<SessionPlannerSceneTimelineProjection> currentSupplier,
            Function<Consumer<SessionPlannerSceneTimelineProjection>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? SessionPlannerSceneTimelineProjection::empty
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public SessionPlannerSceneTimelineProjection current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SessionPlannerSceneTimelineProjection> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
