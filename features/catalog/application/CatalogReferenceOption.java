package features.catalog.application;

import java.util.Objects;

/** Stable Catalog selector option projected from provider-owned reference truth. */
public record CatalogReferenceOption(long id, String label) {

    public CatalogReferenceOption {
        id = Math.max(0L, id);
        label = Objects.requireNonNullElse(label, "");
    }
}
