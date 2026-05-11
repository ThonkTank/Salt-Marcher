package src.data.creatures.mapper;

import src.data.creatures.model.CreatureFilterValuesRecord;
import src.domain.creatures.model.catalog.model.CreatureCatalogData;

public final class CreatureFilterValuesMapper {

    private CreatureFilterValuesMapper() {
    }

    public static CreatureCatalogData.DistinctFilterValues toQueryValues(CreatureFilterValuesRecord record) {
        return new CreatureCatalogData.DistinctFilterValues(
                record.sizes(),
                record.types(),
                record.subtypes(),
                record.biomes(),
                record.alignments());
    }
}
