package src.domain.encounter;

import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.generation.model.EncounterRequestedDifficulty;
import src.domain.encounter.model.generation.model.EncounterTuningIntent;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterStateSnapshot;

final class EncounterBuilderInputsProjectionServiceAssembly {

    private EncounterBuilderInputsProjectionServiceAssembly() {
    }

    static EncounterBuilderInputs toPublishedBuilderInputs(EncounterGenerationInputs inputs) {
        EncounterGenerationInputs safeInputs = inputs == null ? EncounterGenerationInputs.empty() : inputs;
        EncounterRequestedDifficulty difficulty = safeInputs.targetDifficulty();
        EncounterTuningIntent tuning = safeInputs.tuning();
        return new EncounterBuilderInputs(
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                isAutoDifficulty(difficulty),
                publishedDifficultyLevel(difficulty),
                isAutoBalance(tuning),
                publishedBalanceLevel(tuning),
                isAutoAmount(tuning),
                publishedAmountValue(tuning),
                isAutoDiversity(tuning),
                publishedDiversityLevel(tuning),
                safeInputs.encounterTableIds());
    }

    static EncounterStateSnapshot.BuilderSettings toPublishedBuilderSettings(
            EncounterGenerationInputs inputs
    ) {
        EncounterBuilderInputs published = toPublishedBuilderInputs(inputs);
        return new EncounterStateSnapshot.BuilderSettings(
                published.autoDifficulty() ? "Auto" : difficultyLabel(published.difficultyLevel()),
                published.autoBalance() ? -1 : published.balanceLevel(),
                published.autoAmount() ? -1.0 : published.amountValue(),
                published.autoDiversity() ? -1 : published.diversityLevel());
    }

    private static boolean isAutoDifficulty(EncounterRequestedDifficulty difficulty) {
        return difficulty == null || difficulty.isAuto();
    }

    private static int publishedDifficultyLevel(EncounterRequestedDifficulty difficulty) {
        return difficulty == null
                ? EncounterRequestedDifficulty.autoDifficulty().publishedDifficultyLevel()
                : difficulty.publishedDifficultyLevel();
    }

    private static boolean isAutoBalance(EncounterTuningIntent tuning) {
        return tuning == null || tuning.isBalanceAuto();
    }

    private static int publishedBalanceLevel(EncounterTuningIntent tuning) {
        return tuning == null
                ? EncounterTuningIntent.defaultIntent().publishedBalanceLevel()
                : tuning.publishedBalanceLevel();
    }

    private static boolean isAutoAmount(EncounterTuningIntent tuning) {
        return tuning == null || tuning.isAmountAuto();
    }

    private static double publishedAmountValue(EncounterTuningIntent tuning) {
        return tuning == null
                ? EncounterTuningIntent.defaultIntent().publishedAmountValue()
                : tuning.publishedAmountValue();
    }

    private static boolean isAutoDiversity(EncounterTuningIntent tuning) {
        return tuning == null || tuning.isDiversityAuto();
    }

    private static int publishedDiversityLevel(EncounterTuningIntent tuning) {
        return tuning == null
                ? EncounterTuningIntent.defaultIntent().publishedDiversityLevel()
                : tuning.publishedDiversityLevel();
    }

    private static String difficultyLabel(int difficultyLevel) {
        return switch (difficultyLevel) {
            case 1 -> "Easy";
            case 3 -> "Hard";
            case 4 -> "Deadly";
            default -> "Medium";
        };
    }
}
