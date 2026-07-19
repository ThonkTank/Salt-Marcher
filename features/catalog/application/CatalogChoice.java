package features.catalog.application;

import java.util.Objects;

/** Typed displayed choice without presentation-framework ownership. */
public record CatalogChoice<V>(V value, String label) {
    public CatalogChoice {
        value = Objects.requireNonNull(value, "value");
        label = Objects.requireNonNullElse(label, "");
    }
}
