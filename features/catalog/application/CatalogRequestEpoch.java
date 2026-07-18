package features.catalog.application;

import java.util.EnumMap;
import java.util.Map;

final class CatalogRequestEpoch {

    private final Map<CatalogRequestToken.RequestKind, Long> revisions =
            new EnumMap<>(CatalogRequestToken.RequestKind.class);
    private long lifecycleEpoch;
    private boolean active;

    synchronized void activate() {
        if (active) {
            return;
        }
        lifecycleEpoch++;
        active = true;
        revisions.clear();
    }

    synchronized void deactivate() {
        if (!active) {
            return;
        }
        active = false;
        lifecycleEpoch++;
        revisions.clear();
    }

    synchronized CatalogRequestToken begin(CatalogRequestToken.RequestKind kind) {
        long revision = revisions.merge(kind, 1L, Long::sum);
        return new CatalogRequestToken(lifecycleEpoch, kind, revision);
    }

    synchronized boolean accepts(CatalogRequestToken token) {
        return active
                && token != null
                && token.lifecycleEpoch() == lifecycleEpoch
                && revisions.getOrDefault(token.kind(), 0L) == token.revision();
    }

    synchronized void runIfAccepted(CatalogRequestToken token, Runnable action) {
        if (accepts(token)) {
            action.run();
        }
    }
}
