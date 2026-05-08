package src.domain.encounter.application;

import src.domain.encounter.generation.value.EncounterGenerationInputs;
import src.domain.encounter.generation.value.EncounterRequestedDifficulty;
import src.domain.encounter.generation.value.EncounterTuningIntent;
import src.domain.encounter.published.EncounterBuilderInputs;

public final class EncounterBuilderInputsBoundaryTranslator {

    private EncounterBuilderInputsBoundaryTranslator() {
    }

    public static EncounterGenerationInputs toInternal(EncounterBuilderInputs inputs) {
        EncounterBuilderInputs safeInputs = inputs == null ? EncounterBuilderInputs.empty() : inputs;
        return new EncounterGenerationInputs(
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                EncounterRequestedDifficulty.fromPublishedDifficulty(
                        safeInputs.autoDifficulty(),
                        safeInputs.difficultyLevel()),
                EncounterTuningIntent.fromPublishedValues(
                        safeInputs.autoBalance(),
                        safeInputs.balanceLevel(),
                        safeInputs.autoAmount(),
                        safeInputs.amountValue(),
                        safeInputs.autoDiversity(),
                        safeInputs.diversityLevel()),
                safeInputs.encounterTableIds());
    }

    public static EncounterBuilderInputs toPublished(EncounterGenerationInputs inputs) {
        EncounterGenerationInputs safeInputs = inputs == null ? EncounterGenerationInputs.empty() : inputs;
        EncounterRequestedDifficulty difficulty = safeInputs.targetDifficulty();
        EncounterTuningIntent tuning = safeInputs.tuning();
        return new EncounterBuilderInputs(
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                isAutoDifficulty(difficulty),
                difficulty == null
                        ? EncounterRequestedDifficulty.autoDifficulty().publishedDifficultyLevel()
                        : difficulty.publishedDifficultyLevel(),
                isAutoBalance(tuning),
                tuning == null ? EncounterTuningIntent.defaultIntent().publishedBalanceLevel() : tuning.publishedBalanceLevel(),
                isAutoAmount(tuning),
                tuning == null ? EncounterTuningIntent.defaultIntent().publishedAmountValue() : tuning.publishedAmountValue(),
                isAutoDiversity(tuning),
                tuning == null
                        ? EncounterTuningIntent.defaultIntent().publishedDiversityLevel()
                        : tuning.publishedDiversityLevel(),
                safeInputs.encounterTableIds());
    }

    private static boolean isAutoDifficulty(EncounterRequestedDifficulty difficulty) {
        return difficulty == null || difficulty.isAuto();
    }

    private static boolean isAutoBalance(EncounterTuningIntent tuning) {
        return tuning == null || tuning.isBalanceAuto();
    }

    private static boolean isAutoAmount(EncounterTuningIntent tuning) {
        return tuning == null || tuning.isAmountAuto();
    }

    private static boolean isAutoDiversity(EncounterTuningIntent tuning) {
        return tuning == null || tuning.isDiversityAuto();
    }
}
