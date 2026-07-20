package features.encounter.domain.generation;

import java.util.List;

public record EncounterCreatureFilters(
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes
) {

    public EncounterCreatureFilters {
        creatureTypes = creatureTypes == null ? List.of() : List.copyOf(creatureTypes);
        creatureSubtypes = creatureSubtypes == null ? List.of() : List.copyOf(creatureSubtypes);
        biomes = biomes == null ? List.of() : List.copyOf(biomes);
    }
}
