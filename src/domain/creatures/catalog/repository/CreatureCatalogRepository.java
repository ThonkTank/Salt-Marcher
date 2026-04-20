package src.domain.creatures.catalog.repository;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogSortField;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureSortDirection;
import src.domain.creatures.published.EncounterCandidate;

import java.util.List;

public interface CreatureCatalogRepository {

    record DistinctFilterValues(
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments
    ) {
        public DistinctFilterValues {
            List<List<String>> normalized = normalizeLists(sizes, types, subtypes, biomes, alignments);
            sizes = normalized.get(0);
            types = normalized.get(1);
            subtypes = normalized.get(2);
            biomes = normalized.get(3);
            alignments = normalized.get(4);
        }

        @Override
        public List<String> alignments() {
            return copyStrings(alignments);
        }

        @Override
        public List<String> biomes() {
            return copyStrings(biomes);
        }

        @Override
        public List<String> sizes() {
            return copyStrings(sizes);
        }

        @Override
        public List<String> subtypes() {
            return copyStrings(subtypes);
        }

        @Override
        public List<String> types() {
            return copyStrings(types);
        }
    }

    record CatalogSearchSpec(
            @Nullable String nameQuery,
            @Nullable Integer minimumXp,
            @Nullable Integer maximumXp,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            CreatureCatalogSortField sortField,
            CreatureSortDirection sortDirection,
            int pageSize,
            int pageOffset
    ) {
        public CatalogSearchSpec {
            sizes = copyStrings(sizes);
            types = copyStrings(types);
            subtypes = copyStrings(subtypes);
            biomes = copyStrings(biomes);
            alignments = copyStrings(alignments);
        }

        @Override
        public List<String> sizes() {
            return copyStrings(sizes);
        }

        @Override
        public List<String> types() {
            return copyStrings(types);
        }

        @Override
        public List<String> subtypes() {
            return copyStrings(subtypes);
        }

        @Override
        public List<String> biomes() {
            return copyStrings(biomes);
        }

        @Override
        public List<String> alignments() {
            return copyStrings(alignments);
        }
    }

    record EncounterCandidateSpec(
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            int minimumXp,
            int maximumXp,
            int limit
    ) {
        public EncounterCandidateSpec {
            types = copyStrings(types);
            subtypes = copyStrings(subtypes);
            biomes = copyStrings(biomes);
        }

        @Override
        public List<String> types() {
            return copyStrings(types);
        }

        @Override
        public List<String> subtypes() {
            return copyStrings(subtypes);
        }

        @Override
        public List<String> biomes() {
            return copyStrings(biomes);
        }
    }

    DistinctFilterValues loadFilterValues();

    CreatureCatalogPage searchCatalog(CatalogSearchSpec spec);

    @Nullable CreatureDetail loadCreatureDetail(long creatureId);

    List<EncounterCandidate> loadEncounterCandidates(EncounterCandidateSpec spec);

    private static List<List<String>> normalizeLists(List<String>... values) {
        return java.util.Arrays.stream(values)
                .map(CreatureCatalogRepository::copyStrings)
                .toList();
    }

    private static List<String> copyStrings(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
