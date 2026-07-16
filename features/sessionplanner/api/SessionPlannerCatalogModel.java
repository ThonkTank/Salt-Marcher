package features.sessionplanner.api;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class SessionPlannerCatalogModel {

    private final Supplier<SessionPlannerCatalogSnapshot> currentSupplier;
    private final Function<Consumer<SessionPlannerCatalogSnapshot>, Runnable> subscribeAction;

    public SessionPlannerCatalogModel(
            Supplier<SessionPlannerCatalogSnapshot> currentSupplier,
            Function<Consumer<SessionPlannerCatalogSnapshot>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? SessionPlannerCatalogSnapshot::empty
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public SessionPlannerCatalogSnapshot current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<SessionPlannerCatalogSnapshot> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
