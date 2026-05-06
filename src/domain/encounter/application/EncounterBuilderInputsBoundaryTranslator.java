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
                toInternalDifficulty(safeInputs.autoDifficulty(), safeInputs.difficultyLevel()),
                new EncounterTuningIntent(
                        safeInputs.autoBalance() ? EncounterTuningIntent.AUTO_BALANCE_LEVEL : safeInputs.balanceLevel(),
                        safeInputs.autoAmount() ? EncounterTuningIntent.AUTO_AMOUNT_VALUE : safeInputs.amountValue(),
                        safeInputs.autoDiversity() ? EncounterTuningIntent.AUTO_DIVERSITY_LEVEL : safeInputs.diversityLevel()),
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
                difficulty == null || difficulty.isAuto(),
                difficultyLevel(difficulty),
                tuning == null || tuning.isBalanceAuto(),
                tuning == null ? EncounterBuilderInputs.empty().balanceLevel() : tuning.balanceLevel(),
                tuning == null || tuning.isAmountAuto(),
                tuning == null ? EncounterBuilderInputs.empty().amountValue() : tuning.amountValue(),
                tuning == null || tuning.isDiversityAuto(),
                tuning == null ? EncounterBuilderInputs.empty().diversityLevel() : tuning.diversityLevel(),
                safeInputs.encounterTableIds());
    }

    private static EncounterRequestedDifficulty toInternalDifficulty(boolean auto, int difficultyLevel) {
        if (auto) {
            return EncounterRequestedDifficulty.AUTO;
        }
        return switch (difficultyLevel) {
            case 1 -> EncounterRequestedDifficulty.EASY;
            case 3 -> EncounterRequestedDifficulty.HARD;
            case 4 -> EncounterRequestedDifficulty.DEADLY;
            default -> EncounterRequestedDifficulty.MEDIUM;
        };
    }

    private static int difficultyLevel(EncounterRequestedDifficulty difficulty) {
        EncounterRequestedDifficulty effective = difficulty == null
                ? EncounterRequestedDifficulty.AUTO
                : difficulty;
        return switch (effective) {
            case EASY -> 1;
            case HARD -> 3;
            case DEADLY -> 4;
            case AUTO, MEDIUM -> 2;
        };
    }
}
