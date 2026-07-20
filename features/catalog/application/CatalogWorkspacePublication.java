package features.catalog.application;

import java.util.Objects;
import java.util.function.Consumer;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;

/** Read-only publication surface for the immutable Catalog workspace state. */
public final class CatalogWorkspacePublication {

    private final PublishedState<CatalogWorkspaceState> state;

    CatalogWorkspacePublication(CatalogWorkspaceState initial, UiDispatcher dispatcher) {
        state = new PublishedState<>(Objects.requireNonNull(initial, "initial"),
                Objects.requireNonNull(dispatcher, "dispatcher"));
    }

    public CatalogWorkspaceState current() {
        return state.current();
    }

    public Runnable subscribe(Consumer<CatalogWorkspaceState> listener) {
        return state.subscribe(Objects.requireNonNull(listener, "listener"));
    }

    Runnable observeLatest(Consumer<CatalogWorkspaceState> observer) {
        return state.observeLatest(Objects.requireNonNull(observer, "observer"));
    }

    void publish(CatalogWorkspaceState next) {
        state.publish(Objects.requireNonNull(next, "next"));
    }
}
