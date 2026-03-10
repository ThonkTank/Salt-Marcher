package features.creatures.api;

import database.DatabaseManager;
import features.creatures.model.Creature;
import features.creatures.repository.CreatureRepository;
import features.creatures.repository.CreatureSearchRepository;
import shared.rules.service.XpCalculator;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Public facade for creature data access.
 */
public final class CreatureCatalogService {
    private static final Logger LOGGER = Logger.getLogger(CreatureCatalogService.class.getName());

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
        try (Connection conn = DatabaseManager.getConnection()) {
            return ServiceResult.ok(CreatureSearchRepository.countAll(conn));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CreatureCatalogService.countAll(): DB access failed", e);
            return ServiceResult.dbAccessFailed(0);
        }
    }

    public static ServiceResult<PageResult> searchCreatures(
            FilterCriteria criteria,
            List<Long> excludeIds,
            List<Long> tableIds,
            PageRequest pageRequest) {
        FilterCriteria effectiveCriteria = criteria != null ? criteria : FilterCriteria.empty();
        PageRequest effectivePage = pageRequest != null ? pageRequest : new PageRequest("name", "ASC", 50, 0);

        Integer xpMin = parseCrToXpOrNull(effectiveCriteria.crMin());
        if (effectiveCriteria.crMin() != null && xpMin == null) {
            LOGGER.warning("CreatureCatalogService.searchCreatures(): unknown CR min value: " + effectiveCriteria.crMin());
            return new ServiceResult<>(Status.INVALID_FILTER, new PageResult(List.of(), 0));
        }
        Integer xpMax = parseCrToXpOrNull(effectiveCriteria.crMax());
        if (effectiveCriteria.crMax() != null && xpMax == null) {
            LOGGER.warning("CreatureCatalogService.searchCreatures(): unknown CR max value: " + effectiveCriteria.crMax());
            return new ServiceResult<>(Status.INVALID_FILTER, new PageResult(List.of(), 0));
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            CreatureSearchRepository.SearchResult r = CreatureSearchRepository.searchWithFiltersAndCount(
                    conn,
                    effectiveCriteria.nameQuery(), xpMin, xpMax,
                    effectiveCriteria.sizes(), effectiveCriteria.types(), effectiveCriteria.subtypes(),
                    effectiveCriteria.biomes(), effectiveCriteria.alignments(),
                    excludeIds, tableIds,
                    effectivePage.sortColumn(), effectivePage.sortDirection(),
                    effectivePage.limit(), effectivePage.offset());
            return ServiceResult.ok(new PageResult(r.creatures(), r.totalCount()));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CreatureCatalogService.searchCreatures(): DB access failed", e);
            return ServiceResult.dbAccessFailed(new PageResult(List.of(), 0));
        }
    }

    public static ServiceResult<Creature> getCreature(Long id) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return ServiceResult.ok(CreatureRepository.getCreature(conn, id));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CreatureCatalogService.getCreature(): DB access failed", e);
            return ServiceResult.dbAccessFailed(null);
        }
    }

    public static ServiceResult<List<Creature>> getCreaturesForEncounter(
            List<String> types, int minXP, int maxXP,
            List<String> biomes, List<String> subtypes) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return ServiceResult.ok(
                    CreatureSearchRepository.getCreaturesByFilters(conn, types, minXP, maxXP, biomes, subtypes));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CreatureCatalogService.getCreaturesForEncounter(): DB access failed", e);
            return ServiceResult.dbAccessFailed(List.of());
        }
    }

    public static ServiceResult<List<Creature>> loadCreaturesByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return ServiceResult.ok(List.of());
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return ServiceResult.ok(CreatureRepository.getCreaturesByIds(conn, ids));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CreatureCatalogService.loadCreaturesByIds(): DB access failed", e);
            return ServiceResult.dbAccessFailed(List.of());
        }
    }

    public static ServiceResult<FilterOptions> loadFilterOptions() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return ServiceResult.ok(new FilterOptions(
                    CreatureSearchRepository.getDistinctSizes(conn),
                    CreatureSearchRepository.getDistinctTypes(conn),
                    CreatureSearchRepository.getDistinctSubtypes(conn),
                    CreatureSearchRepository.getDistinctBiomes(conn),
                    CreatureSearchRepository.getDistinctAlignments(conn),
                    XpCalculator.crValues()
            ));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CreatureCatalogService.loadFilterOptions(): DB access failed", e);
            return ServiceResult.dbAccessFailed(
                    new FilterOptions(List.of(), List.of(), List.of(), List.of(), List.of(), List.of()));
        }
    }

    private static Integer parseCrToXpOrNull(String cr) {
        return cr != null ? XpCalculator.xpForCr(cr) : null;
    }
}
