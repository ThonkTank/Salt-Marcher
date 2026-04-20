package src.data.creatures.mapper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureCatalogPageRecord;
import src.data.creatures.model.CreatureDetailRecord;
import src.data.creatures.model.CreatureFilterValuesRecord;
import src.data.creatures.model.EncounterCandidateRecord;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;
import src.domain.creatures.catalog.port.CreatureCatalogLookup.CreatureProfile;

public final class CreatureCatalogQueryMappingFacade {

    private CreatureCatalogQueryMappingFacade() {
    }

    public static CreatureCatalogLookup.DistinctFilterValues toQueryValues(CreatureFilterValuesRecord record) {
        return CreatureFilterValuesMapper.toQueryValues(record);
    }

    public static CreatureCatalogLookup.CatalogPage toDomain(CreatureCatalogPageRecord record) {
        return CreatureCatalogPageMapper.toDomain(record);
    }

    public static @Nullable CreatureProfile toDomain(@Nullable CreatureDetailRecord record) {
        return CreatureDetailMapper.toDomain(record);
    }

    public static List<CreatureCatalogLookup.EncounterCandidateProfile> toDomain(List<EncounterCandidateRecord> records) {
        return records.stream()
                .map(EncounterCandidateMapper::toDomain)
                .toList();
    }
}
