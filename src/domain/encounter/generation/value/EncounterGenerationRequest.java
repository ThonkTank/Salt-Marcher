package src.domain.encounter.generation.value;

import java.util.List;
import src.domain.encounter.plan.value.EncounterPlanCreature;

public record EncounterGenerationRequest(
        EncounterGenerationInputs inputs,
        int alternativeCount,
        long generationSeed,
        List<Long> excludedCreatureIds,
        List<EncounterPlanCreature> lockedCreatures
) {

    private static final int DEFAULT_ALTERNATIVE_COUNT = 5;

    public EncounterGenerationRequest {
        inputs = inputs == null ? EncounterGenerationInputs.empty() : inputs;
        alternativeCount = Math.max(1, Math.min(10,
                alternativeCount <= 0 ? DEFAULT_ALTERNATIVE_COUNT : alternativeCount));
        generationSeed = Math.max(0L, generationSeed);
        excludedCreatureIds = excludedCreatureIds == null ? List.of() : List.copyOf(excludedCreatureIds);
        lockedCreatures = lockedCreatures == null ? List.of() : List.copyOf(lockedCreatures);
    }

    public List<String> creatureTypes() {
        return inputs.creatureTypes();
    }

    public List<String> creatureSubtypes() {
        return inputs.creatureSubtypes();
    }

    public List<String> biomes() {
        return inputs.biomes();
    }

    public EncounterRequestedDifficulty requestedDifficulty() {
        return inputs.targetDifficulty();
    }

    public EncounterDifficultyIntent targetDifficulty() {
        return requestedDifficulty().resolvedIntent();
    }

    public boolean targetDifficultyAuto() {
        return requestedDifficulty().isAuto();
    }

    public EncounterTuningIntent tuning() {
        return inputs.tuning();
    }

    public List<Long> encounterTableIds() {
        return inputs.encounterTableIds();
    }
}
