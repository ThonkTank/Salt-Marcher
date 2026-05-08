package src.domain.encounter.reference.value;

import java.util.List;

public record EncounterCreatureCandidateCriteria(
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        int minimumXp,
        int maximumXp,
        int limit
) {

    public EncounterCreatureCandidateCriteria {
        creatureTypes = creatureTypes == null ? List.of() : List.copyOf(creatureTypes);
        creatureSubtypes = creatureSubtypes == null ? List.of() : List.copyOf(creatureSubtypes);
        biomes = biomes == null ? List.of() : List.copyOf(biomes);
    }
}
