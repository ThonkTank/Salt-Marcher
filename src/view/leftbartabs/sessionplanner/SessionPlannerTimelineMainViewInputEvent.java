package src.view.leftbartabs.sessionplanner;

public record SessionPlannerTimelineMainViewInputEvent(
        Source source,
        long encounterToken,
        int gapIndex
) {

    public SessionPlannerTimelineMainViewInputEvent {
        source = source == null ? Source.REMOVE_ENCOUNTER_BUTTON : source;
        encounterToken = Math.max(0L, encounterToken);
        gapIndex = Math.max(-1, gapIndex);
    }

    enum Source {
        REMOVE_ENCOUNTER_BUTTON,
        MOVE_ENCOUNTER_UP_BUTTON,
        MOVE_ENCOUNTER_DOWN_BUTTON,
        SHORT_REST_BUTTON,
        LONG_REST_BUTTON,
        CLEAR_REST_BUTTON
    }
}
