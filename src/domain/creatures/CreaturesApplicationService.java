package src.domain.creatures;

import src.domain.creatures.api.CreatureCatalogPageResult;
import src.domain.creatures.api.CreatureCatalogQuery;
import src.domain.creatures.api.CreatureDetailResult;
import src.domain.creatures.api.CreatureFilterOptionsResult;
import src.domain.creatures.api.EncounterCandidatesResult;
import src.domain.creatures.api.EncounterCandidateQuery;
import src.domain.creatures.application.CreatureQueryOperations;
import src.domain.creatures.catalog.CreatureCatalogQueryPort;

import java.util.Objects;

/**
 * Public read-only backend facade for creature catalog access.
 */
public final class CreaturesApplicationService {

    @FunctionalInterface
    public interface Factory {

        CreaturesApplicationService create();
    }

    private final CreatureQueryOperations queries;

    public CreaturesApplicationService(CreatureCatalogQueryPort queryPort) {
        this.queries = new CreatureQueryOperations(Objects.requireNonNull(queryPort, "queryPort"));
    }

    public CreatureFilterOptionsResult loadFilterOptions() {
        return queries.loadFilterOptions();
    }

    public CreatureCatalogPageResult searchCatalog(CreatureCatalogQuery query) {
        return queries.searchCatalog(query);
    }

    public CreatureDetailResult loadCreatureDetail(long creatureId) {
        return queries.loadCreatureDetail(creatureId);
    }

    public EncounterCandidatesResult loadEncounterCandidates(EncounterCandidateQuery query) {
        return queries.loadEncounterCandidates(query);
    }
}
