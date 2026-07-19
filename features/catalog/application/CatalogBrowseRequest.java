package features.catalog.application;

import java.util.Objects;

/** One immutable provider request emitted by the shared browse runtime. */
public record CatalogBrowseRequest<Q>(Q query, int pageSize, int pageOffset, boolean initialLoad) {

    public CatalogBrowseRequest {
        query = Objects.requireNonNull(query, "query");
        pageSize = Math.max(1, pageSize);
        pageOffset = Math.max(0, pageOffset);
    }
}
