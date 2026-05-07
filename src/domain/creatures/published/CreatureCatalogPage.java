package src.domain.creatures.published;

import java.util.List;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

public final class CreatureCatalogPage {

    private final List<CreatureCatalogRow> rows;
    private final int totalCount;
    private final int pageSize;
    private final int pageOffset;

    public CreatureCatalogPage(
            List<CreatureCatalogRow> rows,
            int totalCount,
            int pageSize,
            int pageOffset
    ) {
        this.rows = rows == null ? List.of() : List.copyOf(rows);
        this.totalCount = totalCount;
        this.pageSize = pageSize;
        this.pageOffset = pageOffset;
    }

    public static CreatureCatalogPage fromPage(CreatureCatalogLookup.CatalogPage page) {
        CreatureCatalogLookup.CatalogPage safePage = page == null
                ? new CreatureCatalogLookup.CatalogPage(List.of(), 0, 0, 0)
                : page;
        return new CreatureCatalogPage(
                safePage.rows().stream().map(CreatureCatalogRow::fromRow).toList(),
                safePage.totalCount(),
                safePage.pageSize(),
                safePage.pageOffset());
    }

    public static CreatureCatalogPage empty(int pageSize, int pageOffset) {
        return new CreatureCatalogPage(List.of(), 0, pageSize, pageOffset);
    }

    public List<CreatureCatalogRow> rows() {
        return rows;
    }

    public int totalCount() {
        return totalCount;
    }

    public int pageSize() {
        return pageSize;
    }

    public int pageOffset() {
        return pageOffset;
    }
}
