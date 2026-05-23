package src.view.leftbartabs.sessionplanner;

public record SessionPlannerControlsViewInputEvent(
        boolean createSessionRequested,
        long participantToAddId,
        long participantToRemoveId,
        String encounterDaysText,
        long planIdToAttach
) {

    public SessionPlannerControlsViewInputEvent {
        participantToAddId = Math.max(0L, participantToAddId);
        participantToRemoveId = Math.max(0L, participantToRemoveId);
        encounterDaysText = encounterDaysText == null ? "" : encounterDaysText.trim();
        planIdToAttach = Math.max(0L, planIdToAttach);
    }
}
