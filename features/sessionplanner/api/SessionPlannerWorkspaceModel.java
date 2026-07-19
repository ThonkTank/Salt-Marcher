package features.sessionplanner.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

/** The only model consumed by Session Planner JavaFX. */
public final class SessionPlannerWorkspaceModel {
    private final Supplier<SessionPlannerWorkspaceSnapshot> current;
    private final Function<Consumer<SessionPlannerWorkspaceSnapshot>, Runnable> subscribe;

    public SessionPlannerWorkspaceModel(
            Supplier<SessionPlannerWorkspaceSnapshot> current,
            Function<Consumer<SessionPlannerWorkspaceSnapshot>, Runnable> subscribe
    ) {
        this.current = Objects.requireNonNull(current, "current");
        this.subscribe = Objects.requireNonNull(subscribe, "subscribe");
    }

    public SessionPlannerWorkspaceSnapshot current() {
        return Objects.requireNonNull(current.get(), "current workspace");
    }

    public Runnable subscribe(Consumer<SessionPlannerWorkspaceSnapshot> listener) {
        return Objects.requireNonNull(subscribe.apply(Objects.requireNonNull(listener, "listener")), "unsubscribe");
    }
}
