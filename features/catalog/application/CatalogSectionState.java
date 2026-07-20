package features.catalog.application;

import java.util.Objects;
import java.util.Optional;

/** Complete immutable browse truth retained for one section. */
public record CatalogSectionState<Q, R, K>(
        long revision,
        Lifecycle lifecycle,
        Q draft,
        Q committedQuery,
        long requestEpoch,
        int pageSize,
        int pageOffset,
        int totalCount,
        CatalogSortOrder sortOrder,
        Optional<K> selectedKey,
        long providerRevision,
        boolean stale,
        CatalogResultState<R> result
) {

    public CatalogSectionState {
        revision = Math.max(0L, revision);
        lifecycle = Objects.requireNonNull(lifecycle, "lifecycle");
        draft = Objects.requireNonNull(draft, "draft");
        committedQuery = Objects.requireNonNull(committedQuery, "committedQuery");
        requestEpoch = Math.max(0L, requestEpoch);
        pageSize = Math.max(1, pageSize);
        pageOffset = Math.max(0, pageOffset);
        totalCount = Math.max(0, totalCount);
        sortOrder = Objects.requireNonNull(sortOrder, "sortOrder");
        selectedKey = Objects.requireNonNull(selectedKey, "selectedKey");
        providerRevision = Math.max(0L, providerRevision);
        result = Objects.requireNonNull(result, "result");
    }

    public enum Lifecycle {
        INACTIVE,
        ACTIVE,
        CLOSED
    }
}
