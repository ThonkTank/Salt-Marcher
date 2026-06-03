package src.domain.encounter;

import src.domain.encounter.model.plan.EncounterPlanSummary;

final class EncounterPlanProjectionServiceAssembly {

    private EncounterPlanProjectionServiceAssembly() {
    }

    static src.domain.encounter.published.SavedEncounterPlanSummary toPublishedSummary(
            EncounterPlanSummary summary
    ) {
        if (summary == null) {
            return new src.domain.encounter.published.SavedEncounterPlanSummary(0L, "", "");
        }
        return new src.domain.encounter.published.SavedEncounterPlanSummary(
                summary.id(),
                summary.name(),
                summaryText(summary.generatedLabel(), summary.creatureCount()));
    }

    private static String summaryText(String generatedLabel, int creatureCount) {
        StringBuilder text = new StringBuilder()
                .append(Math.max(0, creatureCount))
                .append(" Kreaturen");
        String safeGeneratedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        if (!safeGeneratedLabel.isBlank()) {
            text.append(" · ").append(safeGeneratedLabel);
        }
        return text.toString();
    }
}
