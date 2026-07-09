package src.view.leftbartabs.sessionplanner;

public record SessionPlannerTimelineMainViewInputEvent(
        String widgetId,
        long sceneToken,
        long leftSceneToken,
        long rightSceneToken,
        long lootToken,
        long participantId,
        int participantChoiceIndex,
        String encounterDaysText,
        String sceneTitleText,
        String sceneNotesText,
        long locationId
) {

    public SessionPlannerTimelineMainViewInputEvent {
        widgetId = widgetId == null ? "" : widgetId;
        sceneToken = Math.max(0L, sceneToken);
        leftSceneToken = Math.max(0L, leftSceneToken);
        rightSceneToken = Math.max(0L, rightSceneToken);
        lootToken = Math.max(0L, lootToken);
        participantId = Math.max(0L, participantId);
        participantChoiceIndex = Math.max(-1, participantChoiceIndex);
        encounterDaysText = encounterDaysText == null ? "" : encounterDaysText;
        sceneTitleText = sceneTitleText == null ? "" : sceneTitleText;
        sceneNotesText = sceneNotesText == null ? "" : sceneNotesText;
        locationId = Math.max(0L, locationId);
    }
}
