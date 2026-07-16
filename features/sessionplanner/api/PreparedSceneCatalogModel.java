package features.sessionplanner.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

/** Revisioned, I/O-free catalog consumed by the Scene runtime. */
public final class PreparedSceneCatalogModel {

    private final Supplier<PreparedSceneCatalogSnapshot> current;
    private final Consumer<Consumer<PreparedSceneCatalogSnapshot>> subscribers;

    public PreparedSceneCatalogModel(
            Supplier<PreparedSceneCatalogSnapshot> current,
            Consumer<Consumer<PreparedSceneCatalogSnapshot>> subscribers
    ) {
        this.current = Objects.requireNonNull(current, "current");
        this.subscribers = Objects.requireNonNull(subscribers, "subscribers");
    }

    public PreparedSceneCatalogSnapshot current() {
        return current.get();
    }

    public void subscribe(Consumer<PreparedSceneCatalogSnapshot> subscriber) {
        subscribers.accept(Objects.requireNonNull(subscriber, "subscriber"));
    }
}
