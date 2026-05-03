package src.view.leftbartabs.sessionplanner;

public record SessionPlannerControlsViewInputEvent(
        boolean importRequested,
        long selectedPlanId
) {

    public SessionPlannerControlsViewInputEvent {
        selectedPlanId = Math.max(0L, selectedPlanId);
    }
}
