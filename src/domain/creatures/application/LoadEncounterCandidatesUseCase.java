package src.domain.creatures.application;

import src.domain.creatures.catalog.port.CreatureCatalogLookup;

import java.util.List;
import java.util.Objects;

public final class LoadEncounterCandidatesUseCase {

    public record LoadResult(
            ValidationStatus status,
            List<CreatureCatalogLookup.EncounterCandidateProfile> candidates
    ) {
        public LoadResult {
            candidates = candidates == null ? List.of() : List.copyOf(candidates);
        }

        public boolean invalidQuery() {
            return status == ValidationStatus.INVALID_QUERY;
        }
    }

    public static final class CandidateQueryInput {

        private final List<String> types;
        private final List<String> subtypes;
        private final List<String> biomes;
        private final int minimumXp;
        private final int maximumXp;
        private final int limit;

        public CandidateQueryInput(
                List<String> types,
                List<String> subtypes,
                List<String> biomes,
                int minimumXp,
                int maximumXp,
                int limit
        ) {
            this.types = types == null ? List.of() : List.copyOf(types);
            this.subtypes = subtypes == null ? List.of() : List.copyOf(subtypes);
            this.biomes = biomes == null ? List.of() : List.copyOf(biomes);
            this.minimumXp = minimumXp;
            this.maximumXp = maximumXp;
            this.limit = limit;
        }

        public List<String> types() {
            return types;
        }

        public List<String> subtypes() {
            return subtypes;
        }

        public List<String> biomes() {
            return biomes;
        }

        public int minimumXp() {
            return minimumXp;
        }

        public int maximumXp() {
            return maximumXp;
        }

        public int limit() {
            return limit;
        }
    }

    private static final int DEFAULT_LIMIT = 250;
    private static final int MAX_LIMIT = 1000;

    private final CreatureCatalogLookup lookup;

    public LoadEncounterCandidatesUseCase(CreatureCatalogLookup lookup) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
    }

    public LoadResult execute(CandidateQueryInput query) {
        if (query == null) {
            return new LoadResult(ValidationStatus.SUCCESS, lookup.loadEncounterCandidates(
                    new CreatureCatalogLookup.EncounterCandidateSpec(List.of(), List.of(), List.of(), 0, Integer.MAX_VALUE, DEFAULT_LIMIT)));
        }
        int limit = normalizeLimit(query.limit());
        int minimumXp = Math.max(0, query.minimumXp());
        int maximumXp = query.maximumXp() <= 0 ? Integer.MAX_VALUE : query.maximumXp();
        if (minimumXp > maximumXp) {
            return new LoadResult(ValidationStatus.INVALID_QUERY, List.of());
        }
        return new LoadResult(
                ValidationStatus.SUCCESS,
                lookup.loadEncounterCandidates(new CreatureCatalogLookup.EncounterCandidateSpec(
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
