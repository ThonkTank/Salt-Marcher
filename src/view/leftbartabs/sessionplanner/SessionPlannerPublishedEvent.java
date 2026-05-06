package src.view.leftbartabs.sessionplanner;

import java.util.Objects;

public record SessionPlannerPublishedEvent(
        Kind kind,
        long planId,
        long encounterToken,
        long leftEncounterId,
        long rightEncounterId,
        RestSelection restSelection,
        long lootToken
) {

    public SessionPlannerPublishedEvent {
        Objects.requireNonNull(kind, "kind");
        planId = Math.max(0L, planId);
        encounterToken = Math.max(0L, encounterToken);
        leftEncounterId = Math.max(0L, leftEncounterId);
        rightEncounterId = Math.max(0L, rightEncounterId);
        restSelection = restSelection == null ? RestSelection.NONE : restSelection;
        lootToken = Math.max(0L, lootToken);
    }

    static SessionPlannerPublishedEvent importPlan(long planId) {
        return new SessionPlannerPublishedEvent(Kind.IMPORT_PLAN, planId, 0L, 0L, 0L, RestSelection.NONE, 0L);
    }

    static SessionPlannerPublishedEvent removeEncounter(long encounterToken) {
        return new SessionPlannerPublishedEvent(Kind.REMOVE_ENCOUNTER, 0L, encounterToken, 0L, 0L, RestSelection.NONE, 0L);
    }

    static SessionPlannerPublishedEvent moveEncounterUp(long encounterToken) {
        return new SessionPlannerPublishedEvent(Kind.MOVE_ENCOUNTER_UP, 0L, encounterToken, 0L, 0L, RestSelection.NONE, 0L);
    }

    static SessionPlannerPublishedEvent moveEncounterDown(long encounterToken) {
        return new SessionPlannerPublishedEvent(Kind.MOVE_ENCOUNTER_DOWN, 0L, encounterToken, 0L, 0L, RestSelection.NONE, 0L);
    }

    static SessionPlannerPublishedEvent setRestGap(
            long leftEncounterId,
            long rightEncounterId,
            RestSelection restSelection
    ) {
        return new SessionPlannerPublishedEvent(
                Kind.SET_REST_GAP,
                0L,
                0L,
                leftEncounterId,
                rightEncounterId,
                restSelection,
                0L);
    }

    static SessionPlannerPublishedEvent clearRestGap(long leftEncounterId, long rightEncounterId) {
        return new SessionPlannerPublishedEvent(
                Kind.CLEAR_REST_GAP,
                0L,
                0L,
                leftEncounterId,
                rightEncounterId,
                RestSelection.NONE,
                0L);
    }

    static SessionPlannerPublishedEvent addLootPlaceholder() {
        return new SessionPlannerPublishedEvent(Kind.ADD_LOOT_PLACEHOLDER, 0L, 0L, 0L, 0L, RestSelection.NONE, 0L);
    }

    static SessionPlannerPublishedEvent removeLootPlaceholder(long lootToken) {
        return new SessionPlannerPublishedEvent(Kind.REMOVE_LOOT_PLACEHOLDER, 0L, 0L, 0L, 0L, RestSelection.NONE, lootToken);
    }

    enum Kind {
        IMPORT_PLAN,
        REMOVE_ENCOUNTER,
        MOVE_ENCOUNTER_UP,
        MOVE_ENCOUNTER_DOWN,
        SET_REST_GAP,
        CLEAR_REST_GAP,
        ADD_LOOT_PLACEHOLDER,
        REMOVE_LOOT_PLACEHOLDER
    }

    enum RestSelection {
        NONE,
        SHORT_REST,
        LONG_REST
    }
}
