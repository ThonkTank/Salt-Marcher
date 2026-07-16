package features.creatures.adapter.sqlite.mapper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.creatures.adapter.sqlite.model.CreatureCatalogPageRecord;
import features.creatures.adapter.sqlite.model.CreatureCatalogSearchCriteriaRecord;
import features.creatures.adapter.sqlite.model.CreatureDetailRecord;
import features.creatures.adapter.sqlite.model.CreatureFilterValuesRecord;
import features.creatures.adapter.sqlite.model.EncounterCandidateCriteriaRecord;
import features.creatures.adapter.sqlite.model.EncounterCandidateRecord;
import features.creatures.domain.catalog.CreatureCatalogData;
import features.creatures.domain.catalog.CreatureCatalogData.CatalogSortField;
import features.creatures.domain.catalog.CreatureCatalogData.CreatureProfile;

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
                toSearchSortField(spec.sortFieldType()),
                CreatureCatalogSearchCriteriaRecord.sortDirection(spec.sortAscending()),
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

    private static CreatureCatalogSearchCriteriaRecord.SortField toSearchSortField(CatalogSortField sortField) {
        return switch (sortField) {
            case CHALLENGE_RATING -> CreatureCatalogSearchCriteriaRecord.SortField.CHALLENGE_RATING;
            case XP -> CreatureCatalogSearchCriteriaRecord.SortField.XP;
            default -> CreatureCatalogSearchCriteriaRecord.SortField.NAME;
        };
    }
}
