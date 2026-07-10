package src.domain.encounter.model.generation;

import java.util.List;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;

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

    public static EncounterCreatureFilters from(UpdateEncounterBuilderInputsCommand command) {
        return new EncounterCreatureFilters(
                command.creatureTypes(),
                command.creatureSubtypes(),
                command.biomes());
    }
}
