package features.creatures.api;

import features.creatures.catalog.CatalogObject;
import features.creatures.catalog.input.CountAllInput;
import features.creatures.catalog.input.LoadCreatureInput;
import features.creatures.catalog.input.LoadCreaturesByIdsInput;
import features.creatures.catalog.input.LoadEncounterCandidatesInput;
import features.creatures.catalog.input.LoadFilterOptionsInput;
import features.creatures.catalog.input.SearchCreaturesInput;
import features.creatures.model.Creature;

import java.util.List;

/**
 * Compatibility facade for older creature catalog callers.
 */
@SuppressWarnings("unused")
public final class CreatureCatalogService {
    private static final CatalogObject CATALOG_OBJECT = new CatalogObject();

    private CreatureCatalogService() {
        throw new AssertionError("No instances");
    }

    public record FilterOptions(List<String> sizes, List<String> types,
                                List<String> subtypes, List<String> biomes,
                                List<String> alignments, List<String> crValues) {}

    public record FilterCriteria(
            String nameQuery, String crMin, String crMax,
            List<String> sizes, List<String> types, List<String> subtypes,
            List<String> biomes, List<String> alignments) {

        public static FilterCriteria empty() {
            return new FilterCriteria(null, null, null,
                    List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }

    public record PageResult(List<Creature> creatures, int totalCount) {}

    public record PageRequest(String sortColumn, String sortDirection, int limit, int offset) {}

    public enum Status {
        OK,
        INVALID_FILTER,
        DB_ACCESS_FAILED
    }

    public record ServiceResult<T>(Status status, T value) {
        public boolean isOk() {
            return status == Status.OK;
        }

        public static <T> ServiceResult<T> ok(T value) {
            return new ServiceResult<>(Status.OK, value);
        }

        public static <T> ServiceResult<T> dbAccessFailed(T fallbackValue) {
            return new ServiceResult<>(Status.DB_ACCESS_FAILED, fallbackValue);
        }
    }

    public static ServiceResult<Integer> countAll() {
        CountAllInput.CountedAllInput counted = CATALOG_OBJECT.countAll(new CountAllInput());
        return counted.success() ? ServiceResult.ok(counted.totalCount()) : ServiceResult.dbAccessFailed(0);
    }

    public static ServiceResult<PageResult> searchCreatures(
            FilterCriteria criteria,
            List<Long> excludeIds,
            List<Long> tableIds,
            PageRequest pageRequest) {
        SearchCreaturesInput.SearchedCreaturesInput searched = CATALOG_OBJECT.searchCreatures(
                new SearchCreaturesInput(
                        criteria != null
                                ? new SearchCreaturesInput.CriteriaInput(
                                        criteria.nameQuery(),
                                        criteria.crMin(),
                                        criteria.crMax(),
                                        criteria.sizes(),
                                        criteria.types(),
                                        criteria.subtypes(),
                                        criteria.biomes(),
                                        criteria.alignments())
                                : null,
                        excludeIds,
                        tableIds,
                        pageRequest != null
                                ? new SearchCreaturesInput.PageInput(
                                        pageRequest.sortColumn(),
                                        pageRequest.sortDirection(),
                                        pageRequest.limit(),
                                        pageRequest.offset())
                                : null));
        PageResult pageResult = new PageResult(searched.creatures(), searched.totalCount());
        if (searched.success()) {
            return ServiceResult.ok(pageResult);
        }
        return searched.invalidCriteria()
                ? new ServiceResult<>(Status.INVALID_FILTER, pageResult)
                : ServiceResult.dbAccessFailed(pageResult);
    }

    public static ServiceResult<Creature> getCreature(Long id) {
        LoadCreatureInput.LoadedCreatureInput loaded = CATALOG_OBJECT.loadCreature(new LoadCreatureInput(id));
        return loaded.success() ? ServiceResult.ok(loaded.creature()) : ServiceResult.dbAccessFailed(null);
    }

    public static ServiceResult<List<Creature>> getCreaturesForEncounter(
            List<String> types, int minXP, int maxXP,
            List<String> biomes, List<String> subtypes) {
        LoadEncounterCandidatesInput.LoadedEncounterCandidatesInput loaded = CATALOG_OBJECT.loadEncounterCandidates(
                new LoadEncounterCandidatesInput(types, minXP, maxXP, biomes, subtypes, false));
        return loaded.success() ? ServiceResult.ok(loaded.creatures()) : ServiceResult.dbAccessFailed(List.of());
    }

    public static ServiceResult<List<Creature>> getCreaturesForEncounterGeneration(
            List<String> types, int minXP, int maxXP,
            List<String> biomes, List<String> subtypes) {
        LoadEncounterCandidatesInput.LoadedEncounterCandidatesInput loaded = CATALOG_OBJECT.loadEncounterCandidates(
                new LoadEncounterCandidatesInput(types, minXP, maxXP, biomes, subtypes, true));
        return loaded.success() ? ServiceResult.ok(loaded.creatures()) : ServiceResult.dbAccessFailed(List.of());
    }

    public static ServiceResult<List<Creature>> loadCreaturesByIds(List<Long> ids) {
        LoadCreaturesByIdsInput.LoadedCreaturesByIdsInput loaded =
                CATALOG_OBJECT.loadCreaturesByIds(new LoadCreaturesByIdsInput(ids, false));
        return loaded.success() ? ServiceResult.ok(loaded.creatures()) : ServiceResult.dbAccessFailed(List.of());
    }

    public static ServiceResult<List<Creature>> loadCreaturesByIdsForEncounterGeneration(List<Long> ids) {
        LoadCreaturesByIdsInput.LoadedCreaturesByIdsInput loaded =
                CATALOG_OBJECT.loadCreaturesByIds(new LoadCreaturesByIdsInput(ids, true));
        return loaded.success() ? ServiceResult.ok(loaded.creatures()) : ServiceResult.dbAccessFailed(List.of());
    }

    public static ServiceResult<FilterOptions> loadFilterOptions() {
        LoadFilterOptionsInput.LoadedFilterOptionsInput loaded =
                CATALOG_OBJECT.loadFilterOptions(new LoadFilterOptionsInput());
        FilterOptions filterOptions = new FilterOptions(
                loaded.sizes(),
                loaded.types(),
                loaded.subtypes(),
                loaded.biomes(),
                loaded.alignments(),
                loaded.crValues());
        return loaded.success() ? ServiceResult.ok(filterOptions) : ServiceResult.dbAccessFailed(filterOptions);
    }
}
