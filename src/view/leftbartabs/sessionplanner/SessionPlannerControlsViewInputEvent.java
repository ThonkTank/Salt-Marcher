package src.view.leftbartabs.sessionplanner;

public record SessionPlannerControlsViewInputEvent(
        String participantToAddValue,
        long participantToRemoveId,
        String encounterDaysText,
        long planIdToAttach
) {

    public SessionPlannerControlsViewInputEvent {
        participantToAddValue = participantToAddValue == null ? "" : participantToAddValue;
        participantToRemoveId = Math.max(0L, participantToRemoveId);
        encounterDaysText = encounterDaysText == null ? "" : encounterDaysText.trim();
        planIdToAttach = Math.max(0L, planIdToAttach);
    }
}
