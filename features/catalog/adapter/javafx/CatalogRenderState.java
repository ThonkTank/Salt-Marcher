package features.catalog.adapter.javafx;

import features.catalog.application.CatalogResultState;
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
        Confirmation<K> confirmation
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

    record Confirmation<K>(long revision, Optional<K> key, String label, boolean required) {
        Confirmation {
            revision = Math.max(0L, revision);
            key = Objects.requireNonNull(key, "key");
            label = Objects.requireNonNullElse(label, "");
        }

        static <K> Confirmation<K> none() {
            return new Confirmation<>(0L, Optional.empty(), "", false);
        }
    }
}
