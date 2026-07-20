package features.catalog.application;

import java.util.Objects;
import java.util.function.Function;

/** Typed text column description without JavaFX ownership. */
public record CatalogColumnSpec<R>(
        String id,
        String label,
        Function<R, String> value,
        boolean sortable
) {
    public CatalogColumnSpec {
        id = Objects.requireNonNullElse(id, "").trim();
        label = Objects.requireNonNullElse(label, "");
        value = Objects.requireNonNull(value, "value");
        if (id.isEmpty()) {
            throw new IllegalArgumentException("Catalog column id must not be blank.");
        }
    }
}
