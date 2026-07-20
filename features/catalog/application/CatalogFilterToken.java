package features.catalog.application;

import java.util.Objects;
import java.util.function.UnaryOperator;

/** One independently removable active-filter chip. */
public record CatalogFilterToken<Q>(String label, UnaryOperator<Q> remove) {
    public CatalogFilterToken {
        label = Objects.requireNonNullElse(label, "").trim();
        remove = Objects.requireNonNull(remove, "remove");
        if (label.isEmpty()) {
            throw new IllegalArgumentException("Catalog filter token label must not be blank.");
        }
    }
}
