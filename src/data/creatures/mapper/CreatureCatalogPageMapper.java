package src.data.creatures.mapper;

import src.data.creatures.model.CreatureCatalogPageRecord;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

public final class CreatureCatalogPageMapper {

    private CreatureCatalogPageMapper() {
    }

    public static CreatureCatalogLookup.CatalogPage toDomain(CreatureCatalogPageRecord record) {
        return new CreatureCatalogLookup.CatalogPage(
                record.rows().stream().map(CreatureCatalogRowMapper::toDomain).toList(),
                record.totalCount(),
                record.pageSize(),
                record.pageOffset());
    }
}
