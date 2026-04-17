package src.domain.creatures.usecase;

import src.domain.creatures.api.EncounterCandidate;
import src.domain.creatures.api.EncounterCandidateQuery;
import src.domain.creatures.repository.CreatureCatalogRepository;

import java.util.List;
import java.util.Objects;

final class LoadEncounterCandidatesUseCase {

    enum LoadStatus {
        SUCCESS,
        INVALID_QUERY
    }

    record LoadResult(
            LoadStatus status,
            List<EncounterCandidate> candidates
    ) {
        public LoadResult {
            candidates = candidates == null ? List.of() : List.copyOf(candidates);
        }
    }

    private static final int DEFAULT_LIMIT = 250;
    private static final int MAX_LIMIT = 1000;

    private final CreatureCatalogRepository repository;

    LoadEncounterCandidatesUseCase(CreatureCatalogRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    LoadResult execute(EncounterCandidateQuery query) {
        if (query == null) {
            return new LoadResult(LoadStatus.SUCCESS, repository.loadEncounterCandidates(
                    new CreatureCatalogRepository.EncounterCandidateSpec(List.of(), List.of(), List.of(), 0, Integer.MAX_VALUE, DEFAULT_LIMIT)));
        }
        int limit = normalizeLimit(query.limit());
        int minimumXp = Math.max(0, query.minimumXp());
        int maximumXp = query.maximumXp() <= 0 ? Integer.MAX_VALUE : query.maximumXp();
        if (minimumXp > maximumXp) {
            return new LoadResult(LoadStatus.INVALID_QUERY, List.of());
        }
        return new LoadResult(
                LoadStatus.SUCCESS,
                repository.loadEncounterCandidates(new CreatureCatalogRepository.EncounterCandidateSpec(
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
