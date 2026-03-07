package features.creaturecatalog.service;

import database.DatabaseManager;
import features.creaturecatalog.model.Creature;
import features.creaturecatalog.repository.CreatureRepository;
import features.creaturecatalog.repository.CreatureSearchRepository;
import features.gamerules.service.XpCalculator;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Facade for creature data access. All UI code goes through here, not directly to the repository.
 * <p>Most methods are currently thin delegations; this layer exists as the intended home for
 * future validation, caching, and cross-entity logic (e.g. creature-type permission checks).
 */
public final class CreatureService {
    private static final Logger LOGGER = Logger.getLogger(CreatureService.class.getName());

    private CreatureService() {
        throw new AssertionError("No instances");
    }

    /** Filter options loaded from the database for populating filter UI controls. */
    public record FilterOptions(List<String> sizes, List<String> types,
                                List<String> subtypes, List<String> biomes,
                                List<String> alignments, List<String> crValues) {}

    /** Immutable search criteria assembled by the filter UI and passed to the data layer. */
    public record FilterCriteria(
            String nameQuery, String crMin, String crMax,
            List<String> sizes, List<String> types, List<String> subtypes,
            List<String> biomes, List<String> alignments) {

        public static FilterCriteria empty() {
            return new FilterCriteria(null, null, null,
                    List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }

    /** Paginated search result returned to the UI layer. */
    public record PageResult(List<Creature> creatures, int totalCount) {}

    /** Pagination and ordering for creature search queries. */
    public record PageRequest(String sortColumn, String sortDirection, int limit, int offset) {}

    /** Typed service-layer status for callers that need to distinguish empty data from DB failures. */
    public enum Status {
        OK,
        INVALID_FILTER,
        DB_ACCESS_FAILED
    }

    /** Service call wrapper with typed status and optional value payload. */
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

    /** Returns the total number of creatures in the database. */
    public static ServiceResult<Integer> countAll() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return ServiceResult.ok(CreatureSearchRepository.countAll(conn));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CreatureService.countAll(): DB access failed", e);
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
            LOGGER.warning("CreatureService.searchCreatures(): unknown CR min value: " + effectiveCriteria.crMin());
            return new ServiceResult<>(Status.INVALID_FILTER, new PageResult(List.of(), 0));
        }
        Integer xpMax = parseCrToXpOrNull(effectiveCriteria.crMax());
        if (effectiveCriteria.crMax() != null && xpMax == null) {
            LOGGER.warning("CreatureService.searchCreatures(): unknown CR max value: " + effectiveCriteria.crMax());
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
            LOGGER.log(Level.WARNING, "CreatureService.searchCreatures(): DB access failed", e);
            return ServiceResult.dbAccessFailed(new PageResult(List.of(), 0));
        }
    }

    public static ServiceResult<Creature> getCreature(Long id) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return ServiceResult.ok(CreatureRepository.getCreature(conn, id));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CreatureService.getCreature(): DB access failed", e);
            return ServiceResult.dbAccessFailed(null);
        }
    }

    /**
     * Loads creatures eligible for encounter generation within the given XP ceiling.
     * Routes through this facade so the repository API is a single choke point.
     */
    public static ServiceResult<List<Creature>> getCreaturesForEncounter(
            List<String> types, int minXP, int maxXP,
            List<String> biomes, List<String> subtypes) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return ServiceResult.ok(
                    CreatureSearchRepository.getCreaturesByFilters(conn, types, minXP, maxXP, biomes, subtypes));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CreatureService.getCreaturesForEncounter(): DB access failed", e);
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
                    XpCalculator.getCrValues()
            ));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CreatureService.loadFilterOptions(): DB access failed", e);
            return ServiceResult.dbAccessFailed(
                    new FilterOptions(List.of(), List.of(), List.of(), List.of(), List.of(), List.of()));
        }
    }

    private static Integer parseCrToXpOrNull(String cr) {
        return cr != null ? XpCalculator.xpForCr(cr) : null;
    }
}
