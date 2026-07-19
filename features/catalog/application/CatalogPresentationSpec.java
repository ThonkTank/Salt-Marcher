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
        boolean paging,
        CatalogSortOrder defaultSort,
        CatalogSortMode sortMode
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
        CatalogSortOrder requiredDefaultSort = Objects.requireNonNull(defaultSort, "defaultSort");
        defaultSort = requiredDefaultSort;
        sortMode = Objects.requireNonNull(sortMode, "sortMode");
        if (columns.isEmpty()) {
            throw new IllegalArgumentException("Catalog sections require at least one column.");
        }
        long matchingSortColumns = columns.stream()
                .filter(column -> column.id().equals(requiredDefaultSort.columnId()) && column.sortable())
                .count();
        if (matchingSortColumns != 1L) {
            throw new IllegalArgumentException("Default Catalog sort must name one sortable column.");
        }
        if (columns.stream().map(CatalogColumnSpec::id).distinct().count() != columns.size()) {
            throw new IllegalArgumentException("Catalog column ids must be unique.");
        }
    }
}
