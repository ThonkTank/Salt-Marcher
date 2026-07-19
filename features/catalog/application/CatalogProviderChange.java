package features.catalog.application;

import java.util.Objects;
import java.util.function.UnaryOperator;

/** A provider revision may invalidate results or replace provider-owned query truth. */
public record CatalogProviderChange<Q>(UnaryOperator<Q> reconcileQuery, boolean queryChanged) {

    public CatalogProviderChange {
        reconcileQuery = Objects.requireNonNull(reconcileQuery, "reconcileQuery");
    }

    public static <Q> CatalogProviderChange<Q> invalidated() {
        return new CatalogProviderChange<>(UnaryOperator.identity(), false);
    }

    public static <Q> CatalogProviderChange<Q> queryChanged(UnaryOperator<Q> reconcileQuery) {
        return new CatalogProviderChange<>(reconcileQuery, true);
    }
}
