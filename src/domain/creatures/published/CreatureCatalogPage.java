package src.domain.creatures.published;

import java.util.List;

public record CreatureCatalogPage(
        List<CreatureCatalogRow> rows,
        int totalCount,
        int pageSize,
        int pageOffset
) {
    public CreatureCatalogPage {
        rows = rows == null ? List.of() : List.copyOf(rows);
    }

    public static CreatureCatalogPage empty(int pageSize, int pageOffset) {
        return new CreatureCatalogPage(List.of(), 0, pageSize, pageOffset);
    }
}
