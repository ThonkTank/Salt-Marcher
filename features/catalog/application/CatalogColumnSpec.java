package features.catalog.application;

import java.util.Objects;
import java.util.function.Function;

/** Typed text column description without JavaFX ownership. */
public record CatalogColumnSpec<R>(String label, Function<R, String> value) {
    public CatalogColumnSpec {
        label = Objects.requireNonNullElse(label, "");
        value = Objects.requireNonNull(value, "value");
    }
}
