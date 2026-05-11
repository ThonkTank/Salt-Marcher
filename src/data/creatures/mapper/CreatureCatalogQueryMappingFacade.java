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
import src.domain.creatures.model.catalog.repository.CreatureCatalogRepository;
import src.domain.creatures.model.catalog.repository.CreatureCatalogRepository.CreatureProfile;

public final class CreatureCatalogQueryMappingFacade {

    private CreatureCatalogQueryMappingFacade() {
    }

    public static CreatureCatalogRepository.DistinctFilterValues toQueryValues(CreatureFilterValuesRecord record) {
        return CreatureFilterValuesMapper.toQueryValues(record);
    }

    public static CreatureCatalogSearchCriteriaRecord toSearchCriteria(
            CreatureCatalogRepository.CatalogSearchSpec spec
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
                toSearchSortDirection(Objects.requireNonNull(spec.sortDirection(), "sortDirection")),
                spec.pageSize(),
                spec.pageOffset());
    }

    public static CreatureCatalogRepository.CatalogPageData toDomain(CreatureCatalogPageRecord record) {
        return CreatureCatalogPageMapper.toDomain(record);
    }

    public static @Nullable CreatureProfile toDomain(@Nullable CreatureDetailRecord record) {
        return CreatureDetailMapper.toDomain(record);
    }

    public static EncounterCandidateCriteriaRecord toEncounterCriteria(
            CreatureCatalogRepository.EncounterCandidateSpec spec
    ) {
        return new EncounterCandidateCriteriaRecord(
                spec.types(),
                spec.subtypes(),
                spec.biomes(),
                spec.minimumXp(),
                spec.maximumXp(),
                spec.limit());
    }

    public static List<CreatureCatalogRepository.EncounterCandidateProfile> toDomain(List<EncounterCandidateRecord> records) {
        return records.stream()
                .map(EncounterCandidateMapper::toDomain)
                .toList();
    }

    private static CreatureCatalogSearchCriteriaRecord.SortField toSearchSortField(
            CreatureCatalogRepository.CatalogSortField sortField
    ) {
        return CreatureCatalogSearchCriteriaRecord.SortField.valueOf(sortField.name());
    }

    private static CreatureCatalogSearchCriteriaRecord.SortDirection toSearchSortDirection(
            CreatureCatalogRepository.CatalogSortDirection sortDirection
    ) {
        return CreatureCatalogSearchCriteriaRecord.SortDirection.valueOf(sortDirection.name());
    }
}
