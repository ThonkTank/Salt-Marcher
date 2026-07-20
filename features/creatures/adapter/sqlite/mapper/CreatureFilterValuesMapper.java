package features.creatures.adapter.sqlite.mapper;

import features.creatures.adapter.sqlite.model.CreatureFilterValuesRecord;
import features.creatures.domain.catalog.CreatureCatalogData;

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
