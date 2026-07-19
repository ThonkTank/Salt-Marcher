package features.catalog.application;

import java.util.Objects;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;

/** The typed provider boundary for one statically composed Catalog section. */
public interface CatalogSectionDefinition<Q, R, K> {

    CatalogSectionId id();

    Q initialQuery();

    default int pageSize() {
        return 50;
    }

    CompletionStage<CatalogBrowseResult<Q, R>> query(CatalogBrowseRequest<Q> request);

    K key(R row);

    CatalogPresentationSpec<Q, R, K> presentation();

    default Q reconcileOnActivate(Q retainedQuery) {
        return Objects.requireNonNull(retainedQuery, "retainedQuery");
    }

    default void activated() {
    }

    default void committed(Q previousQuery, Q committedQuery) {
    }

    default Runnable observeProvider(Consumer<CatalogProviderChange<Q>> listener) {
        Objects.requireNonNull(listener, "listener");
        return () -> { };
    }
}
