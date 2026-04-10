package features.creatures.catalog.input;

import features.creatures.model.Creature;

import java.util.List;

@SuppressWarnings("unused")
public record LoadCreaturesByIdsInput(List<Long> creatureIds, boolean encounterGenerationProjection) {

    public record LoadedCreaturesByIdsInput(boolean success, List<Creature> creatures) {
    }
}
