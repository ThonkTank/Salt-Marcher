package src.data.creatures.mapper;

import src.data.creatures.model.CreatureCatalogPageRecord;
import src.domain.creatures.model.catalog.CreatureCatalogData;

public final class CreatureCatalogPageMapper {

    private CreatureCatalogPageMapper() {
    }

    public static CreatureCatalogData.CatalogPageData toDomain(CreatureCatalogPageRecord record) {
        return new CreatureCatalogData.CatalogPageData(
                record.rows().stream().map(CreatureCatalogRowMapper::toDomain).toList(),
                record.totalCount(),
                record.pageSize(),
                record.pageOffset());
    }
}
