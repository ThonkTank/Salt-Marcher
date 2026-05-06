package src.domain.sessionplanner.published;

public record SessionPlannerStatePanelProjection(
        boolean selectedEncounterAvailable,
        String selectedEncounterTitle,
        String selectedEncounterDetail,
        String selectedEncounterXpSummary,
        String stateContextLabel,
        String placeholderTitle,
        String placeholderDetail
) {

    public SessionPlannerStatePanelProjection {
        selectedEncounterTitle = selectedEncounterTitle == null ? "" : selectedEncounterTitle;
        selectedEncounterDetail = selectedEncounterDetail == null ? "" : selectedEncounterDetail;
        selectedEncounterXpSummary = selectedEncounterXpSummary == null ? "" : selectedEncounterXpSummary;
        stateContextLabel = stateContextLabel == null ? "" : stateContextLabel;
        placeholderTitle = placeholderTitle == null ? "" : placeholderTitle;
        placeholderDetail = placeholderDetail == null ? "" : placeholderDetail;
    }

    public static SessionPlannerStatePanelProjection empty() {
        return new SessionPlannerStatePanelProjection(
                false,
                "Kein Session-Encounter ausgewaehlt",
                "Waehle im Planner einen Encounter aus, um den vorbereitenden State-Kontext zu sehen.",
                "",
                "",
                "Katalog-Vorbereitung",
                "Planner-owned read-only Placeholder.");
    }
}
