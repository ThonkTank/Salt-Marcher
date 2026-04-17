package src.domain.creatures;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureCatalogPage;
import src.domain.creatures.api.CreatureCatalogQuery;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.CreatureFilterOptions;
import src.domain.creatures.api.EncounterCandidate;
import src.domain.creatures.api.EncounterCandidateQuery;
import src.domain.creatures.repository.CreatureCatalogRepository;
import src.domain.creatures.usecase.CreatureQueryOperations;

import java.util.List;
import java.util.Objects;

/**
 * Public read-only backend facade for creature catalog access.
 */
public final class creaturesAPI {

    @FunctionalInterface
    public interface Factory {

        creaturesAPI create();
    }

    private final CreatureQueryOperations queries;

    public creaturesAPI(CreatureCatalogRepository repository) {
        this.queries = new CreatureQueryOperations(Objects.requireNonNull(repository, "repository"));
    }

    public enum ReadStatus {
        SUCCESS,
        STORAGE_ERROR
    }

    public enum QueryStatus {
        SUCCESS,
        INVALID_QUERY,
        STORAGE_ERROR
    }

    public enum LookupStatus {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public enum CatalogSortField {
        NAME,
        CHALLENGE_RATING,
        XP,
        TYPE,
        SIZE
    }

    public enum SortDirection {
        ASCENDING,
        DESCENDING
    }

    public record CreatureFilterOptionsResult(
            ReadStatus status,
            CreatureFilterOptions options
    ) {
    }

    public record CreatureCatalogPageResult(
            QueryStatus status,
            CreatureCatalogPage page
    ) {
    }

    public record CreatureDetailResult(
            LookupStatus status,
            @Nullable CreatureDetail detail
    ) {
    }

    public record EncounterCandidatesResult(
            QueryStatus status,
            List<EncounterCandidate> candidates
    ) {
        public EncounterCandidatesResult {
            candidates = candidates == null ? List.of() : List.copyOf(candidates);
        }
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
