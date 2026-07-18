package features.catalog.application;

import java.util.Objects;
import java.util.function.Consumer;

/** Application-owned, single-attach observation lifetime for the passive workspace renderer. */
public final class CatalogWorkspaceBinding implements AutoCloseable {

    private final CatalogWorkspacePublication publication;
    private Runnable detach;
    private boolean attached;
    private boolean closed;

    public CatalogWorkspaceBinding(CatalogWorkspacePublication publication) {
        this.publication = Objects.requireNonNull(publication, "publication");
    }

    public synchronized void attach(Consumer<CatalogWorkspaceState> renderer) {
        if (closed) {
            throw new IllegalStateException("Catalog workspace binding is closed.");
        }
        if (attached) {
            throw new IllegalStateException("Catalog workspace binding may only be attached once.");
        }
        Runnable acquired = publication.observeLatest(Objects.requireNonNull(renderer, "renderer"));
        detach = acquired;
        attached = true;
    }

    public synchronized void detach() {
        Runnable current = detach;
        detach = null;
        attached = false;
        if (current != null) {
            current.run();
        }
    }

    @Override
    public synchronized void close() {
        if (closed) {
            return;
        }
        detach();
        closed = true;
    }
}
