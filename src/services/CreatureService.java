package services;

import database.DatabaseManager;
import entities.Creature;
import repositories.CreatureRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

/**
 * Facade for creature data access. All UI code goes through here, not directly to the repository.
 * <p>Most methods are currently thin delegations; this layer exists as the intended home for
 * future validation, caching, and cross-entity logic (e.g. creature-type permission checks).
 */
public class CreatureService {

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

    /** Returns the total number of creatures in the database. */
    public static int countAll() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return CreatureRepository.countAll(conn);
        } catch (SQLException e) {
            System.err.println("CreatureService.countAll(): " + e.getMessage());
            return 0;
        }
    }

    public static PageResult searchCreatures(
            String nameQuery,
            String crMin, String crMax,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            String sortColumn, String sortDirection,
            int limit, int offset) {
        Integer xpMin = crMin != null ? XpCalculator.xpForCr(crMin) : null;
        Integer xpMax = crMax != null ? XpCalculator.xpForCr(crMax) : null;
        if (crMin != null && xpMin == null)
            System.err.println("CreatureService.searchCreatures(): unknown CR value: " + crMin);
        if (crMax != null && xpMax == null)
            System.err.println("CreatureService.searchCreatures(): unknown CR value: " + crMax);
        try (Connection conn = DatabaseManager.getConnection()) {
            CreatureRepository.SearchResult r = CreatureRepository.searchWithFiltersAndCount(
                    conn, nameQuery, xpMin, xpMax, sizes, types, subtypes, biomes, alignments,
                    sortColumn, sortDirection, limit, offset);
            return new PageResult(r.creatures(), r.totalCount());
        } catch (SQLException e) {
            System.err.println("CreatureService.searchCreatures(): " + e.getMessage());
            return new PageResult(List.of(), 0);
        }
    }

    public static Creature getCreature(long id) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return CreatureRepository.getCreature(conn, id);
        } catch (SQLException e) {
            System.err.println("CreatureService.getCreature(): " + e.getMessage());
            return null;
        }
    }

    /**
     * Loads creatures eligible for encounter generation within the given XP ceiling.
     * Routes through this facade so the repository API is a single choke point.
     */
    public static List<Creature> getCreaturesForEncounter(
            List<String> types, int minXP, int maxXP,
            List<String> biomes, List<String> subtypes) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return CreatureRepository.getCreaturesByFilters(conn, types, minXP, maxXP, biomes, subtypes);
        } catch (SQLException e) {
            System.err.println("CreatureService.getCreaturesForEncounter(): " + e.getMessage());
            return List.of();
        }
    }

    public static FilterOptions loadFilterOptions() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new FilterOptions(
                    CreatureRepository.getDistinctSizes(conn),
                    CreatureRepository.getDistinctTypes(conn),
                    CreatureRepository.getDistinctSubtypes(conn),
                    CreatureRepository.getDistinctBiomes(conn),
                    CreatureRepository.getDistinctAlignments(conn),
                    XpCalculator.getCrValues()
            );
        } catch (SQLException e) {
            System.err.println("CreatureService.loadFilterOptions(): " + e.getMessage());
            return new FilterOptions(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }
}
