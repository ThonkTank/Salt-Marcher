package features.catalog.application;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;

/** Application-owned, single-attach observation lifetime for the passive workspace renderer. */
public final class CatalogWorkspaceBinding implements AutoCloseable {

    private final Function<Consumer<CatalogWorkspaceState>, Runnable> observeLatest;
    private Runnable detach;
    private boolean attached;
    private boolean closing;
    private boolean closed;

    public CatalogWorkspaceBinding(CatalogWorkspacePublication publication) {
        this(Objects.requireNonNull(publication, "publication")::observeLatest);
    }

    CatalogWorkspaceBinding(Function<Consumer<CatalogWorkspaceState>, Runnable> observeLatest) {
        this.observeLatest = Objects.requireNonNull(observeLatest, "observeLatest");
    }

    public synchronized void attach(Consumer<CatalogWorkspaceState> renderer) {
        if (closing || closed) {
            throw new IllegalStateException("Catalog workspace binding is closed.");
        }
        if (attached) {
            throw new IllegalStateException("Catalog workspace binding may only be attached once.");
        }
        Runnable acquired = Objects.requireNonNull(
                observeLatest.apply(Objects.requireNonNull(renderer, "renderer")), "detach");
        detach = acquired;
        attached = true;
    }

    public synchronized void detach() {
        Runnable current = detach;
        if (current != null) {
            current.run();
            detach = null;
            attached = false;
        }
    }

    @Override
    public synchronized void close() {
        if (closed) {
            return;
        }
        closing = true;
        detach();
        closed = true;
    }
}
