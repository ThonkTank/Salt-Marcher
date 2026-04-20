package src.domain.creatures.application;

import src.domain.creatures.published.EncounterCandidateQuery;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

import java.util.List;
import java.util.Objects;

public final class LoadEncounterCandidatesUseCase {

    public enum LoadStatus {
        SUCCESS,
        INVALID_QUERY
    }

    public record LoadResult(
            LoadStatus status,
            List<CreatureCatalogLookup.EncounterCandidateProfile> candidates
    ) {
        public LoadResult {
            candidates = candidates == null ? List.of() : List.copyOf(candidates);
        }

        public boolean invalidQuery() {
            return status == LoadStatus.INVALID_QUERY;
        }
    }

    private static final int DEFAULT_LIMIT = 250;
    private static final int MAX_LIMIT = 1000;

    private final CreatureCatalogLookup queryPort;

    public LoadEncounterCandidatesUseCase(CreatureCatalogLookup queryPort) {
        this.queryPort = Objects.requireNonNull(queryPort, "queryPort");
    }

    public LoadResult execute(EncounterCandidateQuery query) {
        if (query == null) {
            return new LoadResult(LoadStatus.SUCCESS, queryPort.loadEncounterCandidates(
                    new CreatureCatalogLookup.EncounterCandidateSpec(List.of(), List.of(), List.of(), 0, Integer.MAX_VALUE, DEFAULT_LIMIT)));
        }
        int limit = normalizeLimit(query.limit());
        int minimumXp = Math.max(0, query.minimumXp());
        int maximumXp = query.maximumXp() <= 0 ? Integer.MAX_VALUE : query.maximumXp();
        if (minimumXp > maximumXp) {
            return new LoadResult(LoadStatus.INVALID_QUERY, List.of());
        }
        return new LoadResult(
                LoadStatus.SUCCESS,
                queryPort.loadEncounterCandidates(new CreatureCatalogLookup.EncounterCandidateSpec(
                        query.types(),
                        query.subtypes(),
                        query.biomes(),
                        minimumXp,
                        maximumXp,
                        limit))
        );
    }

    private static int normalizeLimit(int limit) {
        if (limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }
}
