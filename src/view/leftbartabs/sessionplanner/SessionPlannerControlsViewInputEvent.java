package src.view.leftbartabs.sessionplanner;

public record SessionPlannerControlsViewInputEvent(
        long planIdToAttach
) {

    public SessionPlannerControlsViewInputEvent {
        planIdToAttach = Math.max(0L, planIdToAttach);
    }
}
