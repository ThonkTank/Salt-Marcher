package features.catalog.adapter.javafx;

import features.catalog.application.CatalogConfirmation;
import features.catalog.application.CatalogResultState;
import features.catalog.application.CatalogSectionState;
import java.util.Objects;
import java.util.Optional;

/** Immutable renderer input translated from the application workspace publication. */
record CatalogRenderState<Q, R, K>(
        long revision,
        Q draft,
        CatalogResultState<R> result,
        Optional<K> selectedKey,
        int pageSize,
        int pageOffset,
        int totalCount,
        String actionMessage,
        CatalogConfirmation<K> confirmation
) {
    CatalogRenderState {
        revision = Math.max(0L, revision);
        draft = Objects.requireNonNull(draft, "draft");
        result = Objects.requireNonNull(result, "result");
        selectedKey = Objects.requireNonNull(selectedKey, "selectedKey");
        pageSize = Math.max(1, pageSize);
        pageOffset = Math.max(0, pageOffset);
        totalCount = Math.max(0, totalCount);
        actionMessage = Objects.requireNonNullElse(actionMessage, "");
        confirmation = Objects.requireNonNull(confirmation, "confirmation");
    }

    static <Q, R, K> CatalogRenderState<Q, R, K> from(
            long workspaceRevision,
            CatalogSectionState<Q, R, K> state,
            String actionMessage,
            CatalogConfirmation<K> confirmation
    ) {
        CatalogSectionState<Q, R, K> source = Objects.requireNonNull(state, "state");
        return new CatalogRenderState<>(workspaceRevision, source.draft(), source.result(), source.selectedKey(),
                source.pageSize(), source.pageOffset(), source.totalCount(), actionMessage, confirmation);
    }
}
