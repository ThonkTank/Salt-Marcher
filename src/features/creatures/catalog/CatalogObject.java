package features.creatures.catalog;

import database.DatabaseManager;
import features.creatures.catalog.input.CountAllInput;
import features.creatures.catalog.input.LoadCreatureInput;
import features.creatures.catalog.input.LoadCreaturesByIdsInput;
import features.creatures.catalog.input.LoadEncounterCandidatesInput;
import features.creatures.catalog.input.LoadFilterOptionsInput;
import features.creatures.catalog.input.SearchCreaturesInput;
import features.creatures.repository.CreatureRepository;
import features.creatures.repository.CreatureSearchRepository;
import shared.rules.service.XpCalculator;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Canonical root seam for creature catalog reads shared by shell, tables, and
 * encounter consumers.
 */
@SuppressWarnings("unused")
public final class CatalogObject {
    private static final Logger LOGGER = Logger.getLogger(CatalogObject.class.getName());

    public CountAllInput.CountedAllInput countAll(CountAllInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new CountAllInput.CountedAllInput(true, CreatureSearchRepository.countAll(conn));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CatalogObject.countAll(): DB access failed", e);
            return new CountAllInput.CountedAllInput(false, 0);
        }
    }

    public SearchCreaturesInput.SearchedCreaturesInput searchCreatures(SearchCreaturesInput input) {
        SearchCreaturesInput.CriteriaInput criteria = input.criteria() != null
                ? input.criteria()
                : new SearchCreaturesInput.CriteriaInput(
                        null, null, null, List.of(), List.of(), List.of(), List.of(), List.of());
        SearchCreaturesInput.PageInput page = input.page() != null
                ? input.page()
                : new SearchCreaturesInput.PageInput("name", "ASC", 50, 0);

        Integer xpMin = parseCrToXpOrNull(criteria.crMin());
        if (criteria.crMin() != null && xpMin == null) {
            LOGGER.warning("CatalogObject.searchCreatures(): unknown CR min value: " + criteria.crMin());
            return new SearchCreaturesInput.SearchedCreaturesInput(false, true, List.of(), 0);
        }
        Integer xpMax = parseCrToXpOrNull(criteria.crMax());
        if (criteria.crMax() != null && xpMax == null) {
            LOGGER.warning("CatalogObject.searchCreatures(): unknown CR max value: " + criteria.crMax());
            return new SearchCreaturesInput.SearchedCreaturesInput(false, true, List.of(), 0);
        }

        try (Connection conn = DatabaseManager.getConnection()) {
            CreatureSearchRepository.SearchResult result = CreatureSearchRepository.searchWithFiltersAndCount(
                    conn,
                    criteria.nameQuery(),
                    xpMin,
                    xpMax,
                    criteria.sizes(),
                    criteria.types(),
                    criteria.subtypes(),
                    criteria.biomes(),
                    criteria.alignments(),
                    input.excludeIds(),
                    input.tableIds(),
                    page.sortColumn(),
                    page.sortDirection(),
                    page.limit(),
                    page.offset());
            return new SearchCreaturesInput.SearchedCreaturesInput(
                    true,
                    false,
                    result.creatures(),
                    result.totalCount());
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CatalogObject.searchCreatures(): DB access failed", e);
            return new SearchCreaturesInput.SearchedCreaturesInput(false, false, List.of(), 0);
        }
    }

    public LoadCreatureInput.LoadedCreatureInput loadCreature(LoadCreatureInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new LoadCreatureInput.LoadedCreatureInput(
                    true,
                    CreatureRepository.getCreature(conn, input.creatureId()));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CatalogObject.loadCreature(): DB access failed", e);
            return new LoadCreatureInput.LoadedCreatureInput(false, null);
        }
    }

    public LoadEncounterCandidatesInput.LoadedEncounterCandidatesInput loadEncounterCandidates(
            LoadEncounterCandidatesInput input
    ) {
        try (Connection conn = DatabaseManager.getConnection()) {
            List<features.creatures.model.Creature> creatures = input.encounterGenerationProjection()
                    ? CreatureSearchRepository.getCreaturesForEncounterGeneration(
                            conn,
                            input.types(),
                            input.minXp(),
                            input.maxXp(),
                            input.biomes(),
                            input.subtypes())
                    : CreatureSearchRepository.getCreaturesByFilters(
                            conn,
                            input.types(),
                            input.minXp(),
                            input.maxXp(),
                            input.biomes(),
                            input.subtypes());
            return new LoadEncounterCandidatesInput.LoadedEncounterCandidatesInput(true, creatures);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CatalogObject.loadEncounterCandidates(): DB access failed", e);
            return new LoadEncounterCandidatesInput.LoadedEncounterCandidatesInput(false, List.of());
        }
    }

    public LoadCreaturesByIdsInput.LoadedCreaturesByIdsInput loadCreaturesByIds(LoadCreaturesByIdsInput input) {
        if (input.creatureIds() == null || input.creatureIds().isEmpty()) {
            return new LoadCreaturesByIdsInput.LoadedCreaturesByIdsInput(true, List.of());
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            List<features.creatures.model.Creature> creatures = input.encounterGenerationProjection()
                    ? CreatureRepository.getCreaturesByIdsForEncounterGeneration(conn, input.creatureIds())
                    : CreatureRepository.getCreaturesByIds(conn, input.creatureIds());
            return new LoadCreaturesByIdsInput.LoadedCreaturesByIdsInput(true, creatures);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CatalogObject.loadCreaturesByIds(): DB access failed", e);
            return new LoadCreaturesByIdsInput.LoadedCreaturesByIdsInput(false, List.of());
        }
    }

    public LoadFilterOptionsInput.LoadedFilterOptionsInput loadFilterOptions(LoadFilterOptionsInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new LoadFilterOptionsInput.LoadedFilterOptionsInput(
                    true,
                    CreatureSearchRepository.getDistinctSizes(conn),
                    CreatureSearchRepository.getDistinctTypes(conn),
                    CreatureSearchRepository.getDistinctSubtypes(conn),
                    CreatureSearchRepository.getDistinctBiomes(conn),
                    CreatureSearchRepository.getDistinctAlignments(conn),
                    XpCalculator.crValues());
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "CatalogObject.loadFilterOptions(): DB access failed", e);
            return new LoadFilterOptionsInput.LoadedFilterOptionsInput(
                    false,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of());
        }
    }

    private Integer parseCrToXpOrNull(String cr) {
        return cr != null ? XpCalculator.xpForCr(cr) : null;
    }
}
