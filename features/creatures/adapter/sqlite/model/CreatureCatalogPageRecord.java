package features.creatures.adapter.sqlite.model;

import java.util.List;

public record CreatureCatalogPageRecord(
        List<CreatureCatalogRecord> rows,
        int totalCount,
        int pageSize,
        int pageOffset
) {
    public CreatureCatalogPageRecord {
        rows = rows == null ? List.of() : List.copyOf(rows);
    }
}
