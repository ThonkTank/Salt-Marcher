package src.domain.encounter.model.session.model;

import java.util.List;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.session.model.EncounterSessionValues.BuilderStateData;
import src.domain.encounter.model.session.model.EncounterSessionValues.BudgetData;
import src.domain.encounter.model.session.model.EncounterSessionValues.DifficultySummaryData;

final class EncounterSessionGenerationProjection {

    private static final String DEFAULT_MANUAL_TITLE = "Manuelles Encounter";
    private static final String NO_PARTY_DIFFICULTY = "Keine Party";
    private static final int SINGLE_ALTERNATIVE_COUNT = 1;

    private EncounterSessionGenerationProjection() {
    }

    static BuilderStateData builderState(
            EncounterSessionContext context,
            EncounterSessionRosterMutation roster,
            EncounterGenerationInputs builderInputs,
            List<String> generatedAdvisories,
            int generatedAdjustedXp,
            String generatedDifficulty,
            String generatedTitle,
            int selectedAlternativeIndex,
            int alternativeCount,
            boolean generationHistoryPresent
    ) {
        int adjustedXp = generatedAdjustedXp > 0 ? generatedAdjustedXp : roster.totalXp();
        boolean multipleAlternatives = alternativeCount > SINGLE_ALTERNATIVE_COUNT;
        return new BuilderStateData(
                context.activeParty(),
                roster.creatures(),
                titleLabel(generatedTitle, selectedAlternativeIndex, alternativeCount, roster.isEmpty()),
                difficulty(context, roster.isEmpty(), adjustedXp, generatedDifficulty),
                builderInputs,
                generatedAdvisories,
                context.savedPlans(),
                !roster.isEmpty() && context.hasActiveParty(),
                multipleAlternatives,
                multipleAlternatives,
                !roster.isEmpty(),
                generationHistoryPresent || alternativeCount > 0,
                roster.pendingUndo());
    }

    private static DifficultySummaryData difficulty(
            EncounterSessionContext context,
            boolean emptyRoster,
            int adjustedXp,
            String generatedDifficulty
    ) {
        BudgetData currentBudget = context.budget().orElse(null);
        if (currentBudget == null) {
            return new DifficultySummaryData(0, 0, 0, 0, adjustedXp, emptyRoster ? "" : NO_PARTY_DIFFICULTY);
        }
        return new DifficultySummaryData(
                currentBudget.easyXp(),
                currentBudget.mediumXp(),
                currentBudget.hardXp(),
                currentBudget.deadlyXp(),
                adjustedXp,
                generatedDifficulty.isBlank() ? evaluateDifficulty(adjustedXp, currentBudget) : generatedDifficulty);
    }

    private static String titleLabel(String generatedTitle, int selectedAlternativeIndex, int alternativeCount, boolean emptyRoster) {
        if (generatedTitle.isBlank()) {
            return emptyRoster ? "" : DEFAULT_MANUAL_TITLE;
        }
        if (alternativeCount <= SINGLE_ALTERNATIVE_COUNT) {
            return generatedTitle;
        }
        return generatedTitle + " (" + (selectedAlternativeIndex + 1) + "/" + alternativeCount + ")";
    }

    private static String evaluateDifficulty(int adjustedXp, BudgetData budget) {
        if (adjustedXp >= budget.deadlyXp()) {
            return "Deadly";
        }
        if (adjustedXp >= budget.hardXp()) {
            return "Hard";
        }
        if (adjustedXp >= budget.mediumXp()) {
            return "Medium";
        }
        return adjustedXp <= 0 ? "" : "Easy";
    }
}
