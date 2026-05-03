package src.view.leftbartabs.sessionplanner;

public record SessionPlannerTimelineMainViewInputEvent(
        long encounterToken,
        int encounterMoveDelta,
        int gapIndex,
        boolean removeEncounterRequested,
        boolean shortRestRequested,
        boolean longRestRequested,
        boolean clearRestRequested
) {

    public SessionPlannerTimelineMainViewInputEvent {
        encounterToken = Math.max(0L, encounterToken);
        gapIndex = Math.max(-1, gapIndex);
    }
}
