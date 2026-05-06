package src.view.leftbartabs.sessionplanner;

public record SessionPlannerTimelineMainViewInputEvent(
        Kind kind,
        long encounterToken,
        int gapIndex
) {

    public SessionPlannerTimelineMainViewInputEvent {
        kind = kind == null ? Kind.SELECT_ENCOUNTER : kind;
        encounterToken = Math.max(0L, encounterToken);
        gapIndex = Math.max(-1, gapIndex);
    }

    enum Kind {
        SELECT_ENCOUNTER,
        INCREASE_ALLOCATION,
        DECREASE_ALLOCATION,
        MOVE_ENCOUNTER_UP,
        MOVE_ENCOUNTER_DOWN,
        REMOVE_ENCOUNTER,
        SET_SHORT_REST,
        SET_LONG_REST,
        CLEAR_REST
    }
}
