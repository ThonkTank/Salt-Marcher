package features.catalog.application;

import java.util.Objects;

/** Provider-independent result accepted by a {@link BrowseSession}. */
public record CatalogBrowseResult<Q, R>(
        Q acceptedQuery,
        CatalogResultState<R> result,
        int pageOffset,
        int totalCount,
        long providerRevision
) {

    public CatalogBrowseResult {
        acceptedQuery = Objects.requireNonNull(acceptedQuery, "acceptedQuery");
        result = Objects.requireNonNull(result, "result");
        pageOffset = Math.max(0, pageOffset);
        totalCount = Math.max(0, totalCount);
        providerRevision = Math.max(0L, providerRevision);
    }

    public static <Q, R> CatalogBrowseResult<Q, R> firstPage(
            Q query,
            CatalogResultState<R> result,
            long providerRevision
    ) {
        return new CatalogBrowseResult<>(query, result, 0, result.rows().size(), providerRevision);
    }
}
