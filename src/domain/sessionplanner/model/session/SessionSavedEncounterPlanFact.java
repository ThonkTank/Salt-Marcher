package src.domain.sessionplanner.model.session;

public record SessionSavedEncounterPlanFact(
        long planId,
        String name,
        String summaryText
) {

    public SessionSavedEncounterPlanFact {
        planId = Math.max(0L, planId);
        name = name == null ? "" : name.trim();
        summaryText = summaryText == null ? "" : summaryText.trim();
    }
}
