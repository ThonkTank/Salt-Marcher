package features.spells.api;

import features.spells.catalog.CatalogObject;
import features.spells.catalog.input.LoadFilterOptionsInput;
import features.spells.catalog.input.LoadSpellInput;
import features.spells.catalog.input.SearchSpellsInput;

import java.util.List;

/**
 * Compatibility facade for older spell catalog callers.
 */
@SuppressWarnings("unused")
public final class SpellCatalogService {
    private static final CatalogObject CATALOG_OBJECT = new CatalogObject();

    private SpellCatalogService() {
        throw new AssertionError("No instances");
    }

    public record FilterOptions(
            List<String> levels,
            List<String> schools,
            List<String> classes,
            List<String> tags,
            List<String> sources) {}

    public record FilterCriteria(
            String nameQuery,
            boolean ritualOnly,
            boolean concentrationOnly,
            List<String> levels,
            List<String> schools,
            List<String> classes,
            List<String> tags,
            List<String> sources) {

        public static FilterCriteria empty() {
            return new FilterCriteria(null, false, false, List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }

    public record SpellSummary(
            long spellId,
            String name,
            int level,
            String school,
            String classesText,
            boolean ritual,
            boolean concentration,
            String source
    ) {}

    public record SpellDetails(
            long spellId,
            String name,
            String source,
            int level,
            String school,
            String castingTime,
            String rangeText,
            String durationText,
            boolean ritual,
            boolean concentration,
            String componentsText,
            String materialComponentText,
            String classesText,
            String attackOrSaveText,
            String damageEffectText,
            String description,
            String higherLevelsText,
            List<String> tags
    ) {}

    public record PageRequest(String sortColumn, String sortDirection, int limit, int offset) {}
    public record PageResult(List<SpellSummary> spells, int totalCount) {}

    public enum Status {
        OK,
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

    public static ServiceResult<FilterOptions> loadFilterOptions() {
        LoadFilterOptionsInput.LoadedFilterOptionsInput loaded =
                CATALOG_OBJECT.loadFilterOptions(new LoadFilterOptionsInput());
        FilterOptions filterOptions = new FilterOptions(
                loaded.levels(),
                loaded.schools(),
                loaded.classes(),
                loaded.tags(),
                loaded.sources());
        return loaded.success() ? ServiceResult.ok(filterOptions) : ServiceResult.dbAccessFailed(filterOptions);
    }

    public static ServiceResult<PageResult> searchSpells(FilterCriteria criteria, PageRequest pageRequest) {
        SearchSpellsInput.SearchedSpellsInput searched = CATALOG_OBJECT.searchSpells(
                new SearchSpellsInput(
                        criteria != null
                                ? new SearchSpellsInput.CriteriaInput(
                                        criteria.nameQuery(),
                                        criteria.ritualOnly(),
                                        criteria.concentrationOnly(),
                                        criteria.levels(),
                                        criteria.schools(),
                                        criteria.classes(),
                                        criteria.tags(),
                                        criteria.sources())
                                : null,
                        pageRequest != null
                                ? new SearchSpellsInput.PageInput(
                                        pageRequest.sortColumn(),
                                        pageRequest.sortDirection(),
                                        pageRequest.limit(),
                                        pageRequest.offset())
                                : null));
        PageResult pageResult = new PageResult(
                searched.spells().stream().map(SpellCatalogService::toSpellSummary).toList(),
                searched.totalCount());
        return searched.success() ? ServiceResult.ok(pageResult) : ServiceResult.dbAccessFailed(pageResult);
    }

    public static ServiceResult<SpellDetails> getSpell(Long spellId) {
        LoadSpellInput.LoadedSpellInput loaded = CATALOG_OBJECT.loadSpell(new LoadSpellInput(spellId));
        SpellDetails spell = loaded.spell() != null ? toSpellDetails(loaded.spell()) : null;
        return loaded.success() ? ServiceResult.ok(spell) : ServiceResult.dbAccessFailed(spell);
    }

    private static SpellSummary toSpellSummary(SearchSpellsInput.SpellSummaryInput spell) {
        return new SpellSummary(
                spell.spellId(),
                spell.name(),
                spell.level(),
                spell.school(),
                spell.classesText(),
                spell.ritual(),
                spell.concentration(),
                spell.source());
    }

    private static SpellDetails toSpellDetails(LoadSpellInput.SpellDetailsInput spell) {
        return new SpellDetails(
                spell.spellId(),
                spell.name(),
                spell.source(),
                spell.level(),
                spell.school(),
                spell.castingTime(),
                spell.rangeText(),
                spell.durationText(),
                spell.ritual(),
                spell.concentration(),
                spell.componentsText(),
                spell.materialComponentText(),
                spell.classesText(),
                spell.attackOrSaveText(),
                spell.damageEffectText(),
                spell.description(),
                spell.higherLevelsText(),
                spell.tags());
    }
}
