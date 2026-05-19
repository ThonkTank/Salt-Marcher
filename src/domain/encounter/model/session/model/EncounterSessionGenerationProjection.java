package src.domain.encounter.model.session.model;

import src.domain.encounter.model.session.model.BuilderStateData;
import src.domain.encounter.model.session.model.BudgetData;
import src.domain.encounter.model.session.model.DifficultySummaryData;

final class EncounterSessionGenerationProjection {

    private static final String DEFAULT_MANUAL_TITLE = "Manuelles Encounter";
    private static final String NO_PARTY_DIFFICULTY = "Keine Party";
    private static final int SINGLE_ALTERNATIVE_COUNT = 1;

    private EncounterSessionGenerationProjection() {
    }

    static BuilderStateData builderState(
            EncounterSessionContext context,
            EncounterSessionRosterState roster,
            EncounterSessionGenerationState generation
    ) {
        int adjustedXp = generation.generatedAdjustedXp() > 0 ? generation.generatedAdjustedXp() : totalXp(roster);
        boolean multipleAlternatives = generation.alternativeCount() > SINGLE_ALTERNATIVE_COUNT;
        return new BuilderStateData(
                context.activeParty(),
                roster.creatures(),
                titleLabel(generation, roster.creatures().isEmpty()),
                difficulty(context, roster.creatures().isEmpty(), adjustedXp, generation.generatedDifficulty()),
                generation.builderInputs(),
                generation.generatedAdvisories(),
                context.savedPlans(),
                !roster.creatures().isEmpty() && context.hasActiveParty(),
                multipleAlternatives,
                multipleAlternatives,
                !roster.creatures().isEmpty(),
                generation.generationHistoryPresent() || generation.alternativeCount() > 0,
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

    private static String titleLabel(EncounterSessionGenerationState generation, boolean emptyRoster) {
        if (generation.generatedTitle().isBlank()) {
            return emptyRoster ? "" : DEFAULT_MANUAL_TITLE;
        }
        if (generation.alternativeCount() <= SINGLE_ALTERNATIVE_COUNT) {
            return generation.generatedTitle();
        }
        return generation.generatedTitle()
                + " ("
                + (generation.selectedAlternativeIndex() + 1)
                + "/"
                + generation.alternativeCount()
                + ")";
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

    private static int totalXp(EncounterSessionRosterState roster) {
        int total = 0;
        for (EncounterCreatureData creature : roster.creatures()) {
            total += creature.totalXp();
        }
        return total;
    }
}
