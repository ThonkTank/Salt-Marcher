package src.domain.encounter.application;

import src.domain.encounter.plan.value.EncounterPlanSummary;
import src.domain.encounter.published.SavedEncounterPlanChoice;

public final class EncounterPlanBoundaryTranslator {

    private static final String CREATURES_SUFFIX = " Kreaturen";

    private EncounterPlanBoundaryTranslator() {
    }

    public static SavedEncounterPlanChoice toPublishedChoice(EncounterPlanSummary summary) {
        if (summary == null) {
            return new SavedEncounterPlanChoice(0L, "", "");
        }
        return new SavedEncounterPlanChoice(
                summary.id(),
                summary.name(),
                summaryText(summary.generatedLabel(), summary.creatureCount()));
    }

    public static String summaryText(String generatedLabel, int creatureCount) {
        StringBuilder text = new StringBuilder()
                .append(Math.max(0, creatureCount))
                .append(CREATURES_SUFFIX);
        String safeGeneratedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        if (!safeGeneratedLabel.isBlank()) {
            text.append(" · ").append(safeGeneratedLabel);
        }
        return text.toString();
    }
}
