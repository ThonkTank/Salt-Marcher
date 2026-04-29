package src.view.leftbartabs.sessionplanner;

public record SessionPlannerPublishedEvent(
        Kind kind,
        long planId,
        long encounterToken,
        int gapIndex,
        RestSelection restSelection,
        long lootToken
) {

    public SessionPlannerPublishedEvent {
        kind = kind == null ? Kind.REFRESH : kind;
        planId = Math.max(0L, planId);
        encounterToken = Math.max(0L, encounterToken);
        gapIndex = Math.max(-1, gapIndex);
        restSelection = restSelection == null ? RestSelection.NONE : restSelection;
        lootToken = Math.max(0L, lootToken);
    }

    static SessionPlannerPublishedEvent refresh() {
        return new SessionPlannerPublishedEvent(Kind.REFRESH, 0L, 0L, -1, RestSelection.NONE, 0L);
    }

    static SessionPlannerPublishedEvent importPlan(long planId) {
        return new SessionPlannerPublishedEvent(Kind.IMPORT_PLAN, planId, 0L, -1, RestSelection.NONE, 0L);
    }

    static SessionPlannerPublishedEvent removeEncounter(long encounterToken) {
        return new SessionPlannerPublishedEvent(Kind.REMOVE_ENCOUNTER, 0L, encounterToken, -1, RestSelection.NONE, 0L);
    }

    static SessionPlannerPublishedEvent moveEncounterUp(long encounterToken) {
        return new SessionPlannerPublishedEvent(Kind.MOVE_ENCOUNTER_UP, 0L, encounterToken, -1, RestSelection.NONE, 0L);
    }

    static SessionPlannerPublishedEvent moveEncounterDown(long encounterToken) {
        return new SessionPlannerPublishedEvent(Kind.MOVE_ENCOUNTER_DOWN, 0L, encounterToken, -1, RestSelection.NONE, 0L);
    }

    static SessionPlannerPublishedEvent setRestGap(int gapIndex, RestSelection restSelection) {
        return new SessionPlannerPublishedEvent(Kind.SET_REST_GAP, 0L, 0L, gapIndex, restSelection, 0L);
    }

    static SessionPlannerPublishedEvent clearRestGap(int gapIndex) {
        return new SessionPlannerPublishedEvent(Kind.CLEAR_REST_GAP, 0L, 0L, gapIndex, RestSelection.NONE, 0L);
    }

    static SessionPlannerPublishedEvent addLootPlaceholder() {
        return new SessionPlannerPublishedEvent(Kind.ADD_LOOT_PLACEHOLDER, 0L, 0L, -1, RestSelection.NONE, 0L);
    }

    static SessionPlannerPublishedEvent removeLootPlaceholder(long lootToken) {
        return new SessionPlannerPublishedEvent(Kind.REMOVE_LOOT_PLACEHOLDER, 0L, 0L, -1, RestSelection.NONE, lootToken);
    }

    enum Kind {
        REFRESH,
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
