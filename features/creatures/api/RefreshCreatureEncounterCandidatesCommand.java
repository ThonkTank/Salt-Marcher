package features.creatures.api;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record RefreshCreatureEncounterCandidatesCommand(
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        String nameQuery,
        String challengeRatingMin,
        String challengeRatingMax,
        List<String> sizes,
        List<String> alignments,
        int minimumXp,
        int maximumXp,
        int limit
) {

    public RefreshCreatureEncounterCandidatesCommand(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            int minimumXp,
            int maximumXp,
            int limit
    ) {
        this(creatureTypes, creatureSubtypes, biomes, "", "", "", List.of(), List.of(),
                minimumXp, maximumXp, limit);
    }

    public RefreshCreatureEncounterCandidatesCommand {
        creatureTypes = copyStrings(creatureTypes);
        creatureSubtypes = copyStrings(creatureSubtypes);
        biomes = copyStrings(biomes);
        nameQuery = nameQuery == null ? "" : nameQuery.trim();
        challengeRatingMin = challengeRatingMin == null ? "" : challengeRatingMin.trim();
        challengeRatingMax = challengeRatingMax == null ? "" : challengeRatingMax.trim();
        sizes = copyStrings(sizes);
        alignments = copyStrings(alignments);
    }

    @Override
    public List<String> creatureTypes() {
        return List.copyOf(creatureTypes);
    }

    @Override
    public List<String> creatureSubtypes() {
        return List.copyOf(creatureSubtypes);
    }

    @Override
    public List<String> biomes() {
        return List.copyOf(biomes);
    }

    private static List<String> copyStrings(@Nullable List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
