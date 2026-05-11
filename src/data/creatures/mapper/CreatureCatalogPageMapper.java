package src.data.creatures.mapper;

import src.data.creatures.model.CreatureCatalogPageRecord;
import src.domain.creatures.model.catalog.port.CreatureCatalogLookup;

public final class CreatureCatalogPageMapper {

    private CreatureCatalogPageMapper() {
    }

    public static CreatureCatalogLookup.CatalogPageData toDomain(CreatureCatalogPageRecord record) {
        return new CreatureCatalogLookup.CatalogPageData(
                record.rows().stream().map(CreatureCatalogRowMapper::toDomain).toList(),
                record.totalCount(),
                record.pageSize(),
                record.pageOffset());
    }
}
