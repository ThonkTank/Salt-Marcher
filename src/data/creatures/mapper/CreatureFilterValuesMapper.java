package src.data.creatures.mapper;

import src.data.creatures.model.CreatureFilterValuesRecord;
import src.domain.creatures.catalog.CreatureCatalogQueryPort;

public final class CreatureFilterValuesMapper {

    private CreatureFilterValuesMapper() {
    }

    public static CreatureCatalogQueryPort.DistinctFilterValues toQueryValues(CreatureFilterValuesRecord record) {
        return new CreatureCatalogQueryPort.DistinctFilterValues(
                record.sizes(),
                record.types(),
                record.subtypes(),
                record.biomes(),
                record.alignments());
    }
}
