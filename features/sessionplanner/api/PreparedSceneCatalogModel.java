package features.sessionplanner.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

/** Revisioned, I/O-free catalog consumed by the Scene runtime. */
public final class PreparedSceneCatalogModel {

    private final Supplier<PreparedSceneCatalogSnapshot> current;
    private final Function<Consumer<PreparedSceneCatalogSnapshot>, Runnable> subscribe;

    public PreparedSceneCatalogModel(
            Supplier<PreparedSceneCatalogSnapshot> current,
            Function<Consumer<PreparedSceneCatalogSnapshot>, Runnable> subscribe
    ) {
        this.current = Objects.requireNonNull(current, "current");
        this.subscribe = Objects.requireNonNull(subscribe, "subscribe");
    }

    public PreparedSceneCatalogSnapshot current() {
        return current.get();
    }

    public Runnable subscribe(Consumer<PreparedSceneCatalogSnapshot> subscriber) {
        return Objects.requireNonNull(
                subscribe.apply(Objects.requireNonNull(subscriber, "subscriber")), "unsubscribe");
    }
}
