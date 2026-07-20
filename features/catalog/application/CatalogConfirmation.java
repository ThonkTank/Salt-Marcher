package features.catalog.application;

import java.util.Objects;
import java.util.Optional;

/** Stable application token for a confirmation currently offered by one Catalog section. */
public record CatalogConfirmation<K>(long revision, Optional<K> key, String label, boolean required) {

    public CatalogConfirmation {
        revision = Math.max(0L, revision);
        key = Objects.requireNonNull(key, "key");
        label = Objects.requireNonNullElse(label, "");
    }

    public static <K> CatalogConfirmation<K> none() {
        return new CatalogConfirmation<>(0L, Optional.empty(), "", false);
    }

    public CatalogConfirmation<K> clear() {
        return new CatalogConfirmation<>(revision + 1L, Optional.empty(), "", false);
    }
}
