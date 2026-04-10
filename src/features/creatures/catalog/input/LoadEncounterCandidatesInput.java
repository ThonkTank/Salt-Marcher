package features.creatures.catalog.input;

import features.creatures.model.Creature;

import java.util.List;

@SuppressWarnings("unused")
public record LoadEncounterCandidatesInput(
        List<String> types,
        int minXp,
        int maxXp,
        List<String> biomes,
        List<String> subtypes,
        boolean encounterGenerationProjection
) {

    public record LoadedEncounterCandidatesInput(boolean success, List<Creature> creatures) {
    }
}
