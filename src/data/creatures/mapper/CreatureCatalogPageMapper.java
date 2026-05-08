package src.data.creatures.mapper;

import src.data.creatures.model.CreatureCatalogPageRecord;
import src.domain.creatures.published.CreatureCatalogPage;

public final class CreatureCatalogPageMapper {

    private CreatureCatalogPageMapper() {
    }

    public static CreatureCatalogPage toDomain(CreatureCatalogPageRecord record) {
        return new CreatureCatalogPage(
                record.rows().stream().map(CreatureCatalogRowMapper::toDomain).toList(),
                record.totalCount(),
                record.pageSize(),
                record.pageOffset());
    }
}
