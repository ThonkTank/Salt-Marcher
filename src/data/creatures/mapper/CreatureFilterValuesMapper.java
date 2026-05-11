package src.data.creatures.mapper;

import src.data.creatures.model.CreatureFilterValuesRecord;
import src.domain.creatures.model.catalog.repository.CreatureCatalogRepository;

public final class CreatureFilterValuesMapper {

    private CreatureFilterValuesMapper() {
    }

    public static CreatureCatalogRepository.DistinctFilterValues toQueryValues(CreatureFilterValuesRecord record) {
        return new CreatureCatalogRepository.DistinctFilterValues(
                record.sizes(),
                record.types(),
                record.subtypes(),
                record.biomes(),
                record.alignments());
    }
}
