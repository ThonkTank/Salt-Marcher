package features.spells.api;

import features.spells.service.SpellCatalogApplicationService;

import java.util.List;

public final class SpellCatalogService {

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
        return SpellCatalogApplicationService.loadFilterOptions();
    }

    public static ServiceResult<PageResult> searchSpells(FilterCriteria criteria, PageRequest pageRequest) {
        return SpellCatalogApplicationService.searchSpells(criteria, pageRequest);
    }

    public static ServiceResult<SpellDetails> getSpell(Long spellId) {
        return SpellCatalogApplicationService.getSpell(spellId);
    }
}
