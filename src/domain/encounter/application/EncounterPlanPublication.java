package src.domain.encounter.application;

import src.domain.encounter.model.plan.model.EncounterPlanSummary;
import src.domain.encounter.published.SavedEncounterPlanSummary;

final class EncounterPlanPublication {

    private static final String CREATURES_SUFFIX = " Kreaturen";

    private EncounterPlanPublication() {
    }

    static SavedEncounterPlanSummary toPublishedSummary(EncounterPlanSummary summary) {
        if (summary == null) {
            return new SavedEncounterPlanSummary(0L, "", "");
        }
        return new SavedEncounterPlanSummary(
                summary.id(),
                summary.name(),
                summaryText(summary.generatedLabel(), summary.creatureCount()));
    }

    private static String summaryText(String generatedLabel, int creatureCount) {
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
