package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;

public record SessionPlannerTimelineMainViewInputEvent(
        Kind kind,
        long encounterToken,
        BigDecimal targetAllocationPercentage,
        long leftEncounterId,
        long rightEncounterId
) {

    public SessionPlannerTimelineMainViewInputEvent {
        kind = kind == null ? Kind.SELECT_ENCOUNTER : kind;
        encounterToken = Math.max(0L, encounterToken);
        targetAllocationPercentage = targetAllocationPercentage == null ? BigDecimal.ZERO : targetAllocationPercentage;
        leftEncounterId = Math.max(0L, leftEncounterId);
        rightEncounterId = Math.max(0L, rightEncounterId);
    }

    enum Kind {
        SELECT_ENCOUNTER,
        SET_ENCOUNTER_ALLOCATION,
        MOVE_ENCOUNTER_UP,
        MOVE_ENCOUNTER_DOWN,
        REMOVE_ENCOUNTER,
        SET_SHORT_REST,
        SET_LONG_REST,
        CLEAR_REST
    }
}
