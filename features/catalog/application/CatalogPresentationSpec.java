package features.catalog.application;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

/** Complete framework-neutral rendering contract for one Catalog section. */
public record CatalogPresentationSpec<Q, R, K>(
        String accessibleTableName,
        String resultLabel,
        Function<R, String> accessibleRowLabel,
        List<CatalogFilterSpec<Q>> filters,
        List<CatalogColumnSpec<R>> columns,
        Optional<CatalogActionSpec> primaryAction,
        List<CatalogActionSpec> rowActions,
        List<CatalogActionSpec> sectionActions,
        boolean paging
) {
    public CatalogPresentationSpec {
        accessibleTableName = Objects.requireNonNullElse(accessibleTableName, "");
        resultLabel = Objects.requireNonNullElse(resultLabel, "");
        accessibleRowLabel = Objects.requireNonNull(accessibleRowLabel, "accessibleRowLabel");
        filters = List.copyOf(filters);
        columns = List.copyOf(columns);
        primaryAction = Objects.requireNonNull(primaryAction, "primaryAction");
        rowActions = List.copyOf(rowActions);
        sectionActions = List.copyOf(sectionActions);
        if (columns.isEmpty()) {
            throw new IllegalArgumentException("Catalog sections require at least one column.");
        }
    }
}
