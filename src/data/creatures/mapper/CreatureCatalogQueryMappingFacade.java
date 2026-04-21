package src.data.creatures.mapper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureCatalogPageRecord;
import src.data.creatures.model.CreatureCatalogSearchCriteriaRecord;
import src.data.creatures.model.CreatureDetailRecord;
import src.data.creatures.model.CreatureFilterValuesRecord;
import src.data.creatures.model.EncounterCandidateCriteriaRecord;
import src.data.creatures.model.EncounterCandidateRecord;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;
import src.domain.creatures.catalog.port.CreatureCatalogLookup.CreatureProfile;

public final class CreatureCatalogQueryMappingFacade {

    private CreatureCatalogQueryMappingFacade() {
    }

    public static CreatureCatalogLookup.DistinctFilterValues toQueryValues(CreatureFilterValuesRecord record) {
        return CreatureFilterValuesMapper.toQueryValues(record);
    }

    public static CreatureCatalogSearchCriteriaRecord toSearchCriteria(
            CreatureCatalogLookup.CatalogSearchSpec spec
    ) {
        return new CreatureCatalogSearchCriteriaRecord(
                spec.nameQuery(),
                spec.minimumXp(),
                spec.maximumXp(),
                spec.sizes(),
                spec.types(),
                spec.subtypes(),
                spec.biomes(),
                spec.alignments(),
                toSearchSortField(spec.sortField()),
                toSearchSortDirection(spec.sortDirection()),
                spec.pageSize(),
                spec.pageOffset());
    }

    public static CreatureCatalogLookup.CatalogPage toDomain(CreatureCatalogPageRecord record) {
        return CreatureCatalogPageMapper.toDomain(record);
    }

    public static @Nullable CreatureProfile toDomain(@Nullable CreatureDetailRecord record) {
        return CreatureDetailMapper.toDomain(record);
    }

    public static EncounterCandidateCriteriaRecord toEncounterCriteria(
            CreatureCatalogLookup.EncounterCandidateSpec spec
    ) {
        return new EncounterCandidateCriteriaRecord(
                spec.types(),
                spec.subtypes(),
                spec.biomes(),
                spec.minimumXp(),
                spec.maximumXp(),
                spec.limit());
    }

    public static List<CreatureCatalogLookup.EncounterCandidateProfile> toDomain(List<EncounterCandidateRecord> records) {
        return records.stream()
                .map(EncounterCandidateMapper::toDomain)
                .toList();
    }

    private static @Nullable CreatureCatalogSearchCriteriaRecord.SortField toSearchSortField(
            @Nullable CreatureCatalogLookup.SortField sortField
    ) {
        if (sortField == null) {
            return null;
        }
        return CreatureCatalogSearchCriteriaRecord.SortField.valueOf(sortField.name());
    }

    private static @Nullable CreatureCatalogSearchCriteriaRecord.SortDirection toSearchSortDirection(
            @Nullable CreatureCatalogLookup.SortDirection sortDirection
    ) {
        if (sortDirection == null) {
            return null;
        }
        return CreatureCatalogSearchCriteriaRecord.SortDirection.valueOf(sortDirection.name());
    }
}
