package src.data.creatures.mapper;

import src.data.creatures.model.CreatureFilterValuesRecord;
import src.domain.creatures.model.catalog.port.CreatureCatalogLookup;

public final class CreatureFilterValuesMapper {

    private CreatureFilterValuesMapper() {
    }

    public static CreatureCatalogLookup.DistinctFilterValues toQueryValues(CreatureFilterValuesRecord record) {
        return new CreatureCatalogLookup.DistinctFilterValues(
                record.sizes(),
                record.types(),
                record.subtypes(),
                record.biomes(),
                record.alignments());
    }
}
