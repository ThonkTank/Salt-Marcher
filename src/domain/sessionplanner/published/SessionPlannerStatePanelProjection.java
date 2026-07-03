package src.domain.sessionplanner.published;

public record SessionPlannerStatePanelProjection(
        boolean selectedSceneAvailable,
        String selectedSceneTitle,
        String selectedSceneDetail,
        String selectedSceneXpSummary,
        String stateContextLabel,
        String placeholderTitle,
        String placeholderDetail
) {

    public SessionPlannerStatePanelProjection {
        selectedSceneTitle = selectedSceneTitle == null ? "" : selectedSceneTitle;
        selectedSceneDetail = selectedSceneDetail == null ? "" : selectedSceneDetail;
        selectedSceneXpSummary = selectedSceneXpSummary == null ? "" : selectedSceneXpSummary;
        stateContextLabel = stateContextLabel == null ? "" : stateContextLabel;
        placeholderTitle = placeholderTitle == null ? "" : placeholderTitle;
        placeholderDetail = placeholderDetail == null ? "" : placeholderDetail;
    }

    public static SessionPlannerStatePanelProjection empty() {
        return new SessionPlannerStatePanelProjection(
                false,
                "Keine Session-Szene ausgewaehlt",
                "Waehle im Planner eine Szene aus, um den vorbereitenden State-Kontext zu sehen.",
                "",
                "",
                "Katalog-Vorbereitung",
                "Planner-owned read-only Placeholder.");
    }
}
