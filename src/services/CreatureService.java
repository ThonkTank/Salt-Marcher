package services;

import database.DatabaseManager;
import entities.Creature;
import repositories.CreatureRepository;

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

    /** Initializes the database schema. Called once at application startup. */
    public static void initSchema() {
        DatabaseManager.setupDatabase();
    }

    /** Returns the total number of creatures in the database. */
    public static int countAll() {
        return CreatureRepository.countAll();
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
        CreatureRepository.SearchResult r = CreatureRepository.searchWithFiltersAndCount(
                nameQuery, xpMin, xpMax, sizes, types, subtypes, biomes, alignments,
                sortColumn, sortDirection, limit, offset);
        return new PageResult(r.creatures(), r.totalCount());
    }

    public static Creature getCreature(long id) {
        return CreatureRepository.getCreature(id);
    }

    /**
     * Loads creatures eligible for encounter generation within the given XP ceiling.
     * Routes through this facade so the repository API is a single choke point.
     */
    public static List<Creature> getCreaturesForEncounter(
            List<String> types, int minXP, int maxXP,
            List<String> biomes, List<String> subtypes) {
        return CreatureRepository.getCreaturesByFilters(types, minXP, maxXP, biomes, subtypes);
    }

    public static FilterOptions loadFilterOptions() {
        return new FilterOptions(
                CreatureRepository.getDistinctSizes(),
                CreatureRepository.getDistinctTypes(),
                CreatureRepository.getDistinctSubtypes(),
                CreatureRepository.getDistinctBiomes(),
                CreatureRepository.getDistinctAlignments(),
                XpCalculator.getCrValues()
        );
    }
}
