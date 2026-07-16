package features.creatures.adapter.sqlite.mapper;

import features.creatures.adapter.sqlite.model.CreatureCatalogPageRecord;
import features.creatures.domain.catalog.CreatureCatalogData;

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
