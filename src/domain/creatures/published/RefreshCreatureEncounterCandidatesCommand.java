package src.domain.creatures.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record RefreshCreatureEncounterCandidatesCommand(
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        int minimumXp,
        int maximumXp,
        int limit
) {

    public RefreshCreatureEncounterCandidatesCommand {
        creatureTypes = copyStrings(creatureTypes);
        creatureSubtypes = copyStrings(creatureSubtypes);
        biomes = copyStrings(biomes);
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
