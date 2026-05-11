package src.data.creatures.mapper;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureCatalogPageRecord;
import src.data.creatures.model.CreatureCatalogSearchCriteriaRecord;
import src.data.creatures.model.CreatureDetailRecord;
import src.data.creatures.model.CreatureFilterValuesRecord;
import src.data.creatures.model.EncounterCandidateCriteriaRecord;
import src.data.creatures.model.EncounterCandidateRecord;
import src.domain.creatures.model.catalog.model.CreatureCatalogData;
import src.domain.creatures.model.catalog.model.CreatureCatalogData.CreatureProfile;

public final class CreatureCatalogQueryMappingFacade {

    private CreatureCatalogQueryMappingFacade() {
    }

    public static CreatureCatalogData.DistinctFilterValues toQueryValues(CreatureFilterValuesRecord record) {
        return CreatureFilterValuesMapper.toQueryValues(record);
    }

    public static CreatureCatalogSearchCriteriaRecord toSearchCriteria(
            CreatureCatalogData.CatalogSearchSpec spec
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
                toSearchSortField(Objects.requireNonNull(spec.sortField(), "sortField")),
                spec.sortAscending()
                        ? CreatureCatalogSearchCriteriaRecord.SortDirection.ASCENDING
                        : CreatureCatalogSearchCriteriaRecord.SortDirection.DESCENDING,
                spec.pageSize(),
                spec.pageOffset());
    }

    public static CreatureCatalogData.CatalogPageData toDomain(CreatureCatalogPageRecord record) {
        return CreatureCatalogPageMapper.toDomain(record);
    }

    public static @Nullable CreatureProfile toDomain(@Nullable CreatureDetailRecord record) {
        return CreatureDetailMapper.toDomain(record);
    }

    public static EncounterCandidateCriteriaRecord toEncounterCriteria(
            CreatureCatalogData.EncounterCandidateSpec spec
    ) {
        return new EncounterCandidateCriteriaRecord(
                spec.types(),
                spec.subtypes(),
                spec.biomes(),
                spec.minimumXp(),
                spec.maximumXp(),
                spec.limit());
    }

    public static List<CreatureCatalogData.EncounterCandidateProfile> toDomain(List<EncounterCandidateRecord> records) {
        return records.stream()
                .map(EncounterCandidateMapper::toDomain)
                .toList();
    }

    private static CreatureCatalogSearchCriteriaRecord.SortField toSearchSortField(String sortField) {
        return CreatureCatalogSearchCriteriaRecord.SortField.valueOf(sortField);
    }
}
