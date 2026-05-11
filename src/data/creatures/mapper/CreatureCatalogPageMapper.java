package src.data.creatures.mapper;

import src.data.creatures.model.CreatureCatalogPageRecord;
import src.domain.creatures.model.catalog.repository.CreatureCatalogRepository;

public final class CreatureCatalogPageMapper {

    private CreatureCatalogPageMapper() {
    }

    public static CreatureCatalogRepository.CatalogPageData toDomain(CreatureCatalogPageRecord record) {
        return new CreatureCatalogRepository.CatalogPageData(
                record.rows().stream().map(CreatureCatalogRowMapper::toDomain).toList(),
                record.totalCount(),
                record.pageSize(),
                record.pageOffset());
    }
}
