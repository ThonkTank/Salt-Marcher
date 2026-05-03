package src.view.leftbartabs.sessionplanner;

public record SessionPlannerControlsViewInputEvent(
        Source source,
        long selectedPlanId
) {

    public SessionPlannerControlsViewInputEvent {
        source = source == null ? Source.REFRESH_BUTTON : source;
        selectedPlanId = Math.max(0L, selectedPlanId);
    }

    enum Source {
        REFRESH_BUTTON,
        IMPORT_BUTTON
    }
}
