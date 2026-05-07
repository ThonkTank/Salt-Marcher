package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;

enum SessionPlannerSimpleAction {
    CREATE_SESSION,
    ADD_LOOT_PLACEHOLDER;

    static SessionPlannerSimpleAction fallback(SessionPlannerSimpleAction action) {
        return action == null ? values()[0] : action;
    }

    boolean createsSession() {
        return this == CREATE_SESSION;
    }
}

enum SessionPlannerParticipantAction {
    ADD,
    REMOVE;

    boolean addsParticipant() {
        return this == ADD;
    }
}

record SessionPlannerParticipantChange(
        SessionPlannerParticipantAction action,
        long characterId
) {
    SessionPlannerParticipantChange {
        action = action == null ? SessionPlannerParticipantAction.ADD : action;
        characterId = Math.max(0L, characterId);
    }

    boolean hasCharacterId() {
        return characterId > 0L;
    }
}

record SessionPlannerPlanRef(long planId) {
    SessionPlannerPlanRef {
        planId = Math.max(0L, planId);
    }

    boolean isResolved() {
        return planId > 0L;
    }
}

record SessionPlannerEncounterRef(long encounterId) {
    SessionPlannerEncounterRef {
        encounterId = Math.max(0L, encounterId);
    }

    boolean isResolved() {
        return encounterId > 0L;
    }
}

enum SessionPlannerEncounterAction {
    SELECT,
    REMOVE;

    static SessionPlannerEncounterAction fallback(SessionPlannerEncounterAction action) {
        return action == null ? values()[0] : action;
    }

    boolean removesEncounter() {
        return this == REMOVE;
    }
}

enum SessionPlannerDirection {
    UP,
    DOWN;

    static SessionPlannerDirection fallback(SessionPlannerDirection direction) {
        return direction == null ? values()[0] : direction;
    }

    boolean movesDown() {
        return this == DOWN;
    }
}

record SessionPlannerMoveChange(
        SessionPlannerEncounterRef encounter,
        SessionPlannerDirection direction
) {
    SessionPlannerMoveChange {
        encounter = encounter == null ? new SessionPlannerEncounterRef(0L) : encounter;
        direction = SessionPlannerDirection.fallback(direction);
    }

    boolean hasResolvedEncounter() {
        return encounter.isResolved();
    }
}

record SessionPlannerEncounterAllocationChange(
        SessionPlannerEncounterRef encounter,
        BigDecimal budgetPercentage
) {
    SessionPlannerEncounterAllocationChange {
        encounter = encounter == null ? new SessionPlannerEncounterRef(0L) : encounter;
        budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
    }

    boolean hasResolvedEncounter() {
        return encounter.isResolved();
    }
}

record SessionPlannerRestGapRef(
        long leftEncounterId,
        long rightEncounterId
) {
    SessionPlannerRestGapRef {
        leftEncounterId = Math.max(0L, leftEncounterId);
        rightEncounterId = Math.max(0L, rightEncounterId);
    }

    boolean isResolved() {
        return leftEncounterId > 0L && rightEncounterId > 0L;
    }
}

enum SessionPlannerRestSelection {
    NONE,
    SHORT_REST,
    LONG_REST;

    static SessionPlannerRestSelection fallback(SessionPlannerRestSelection selection) {
        return selection == null ? values()[0] : selection;
    }

    boolean clearsRestGap() {
        return this == NONE;
    }
}

record SessionPlannerRestGapChange(
        SessionPlannerRestGapRef gap,
        SessionPlannerRestSelection restSelection
) {
    SessionPlannerRestGapChange {
        gap = gap == null ? new SessionPlannerRestGapRef(0L, 0L) : gap;
        restSelection = SessionPlannerRestSelection.fallback(restSelection);
    }

    boolean isResolvedGap() {
        return gap.isResolved();
    }

    boolean clearsRestGap() {
        return restSelection.clearsRestGap();
    }
}

record SessionPlannerLootRef(long lootToken) {
    SessionPlannerLootRef {
        lootToken = Math.max(0L, lootToken);
    }

    boolean isResolved() {
        return lootToken > 0L;
    }
}
