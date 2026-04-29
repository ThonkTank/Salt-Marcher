package src.view.leftbartabs.sessionplanner;

public record SessionPlannerMainViewInputEvent(
        Kind kind,
        long encounterToken,
        int gapIndex,
        long lootToken
) {

    public SessionPlannerMainViewInputEvent {
        kind = kind == null ? Kind.ADD_LOOT_PLACEHOLDER : kind;
        encounterToken = Math.max(0L, encounterToken);
        gapIndex = Math.max(-1, gapIndex);
        lootToken = Math.max(0L, lootToken);
    }

    static SessionPlannerMainViewInputEvent removeEncounter(long encounterToken) {
        return new SessionPlannerMainViewInputEvent(Kind.REMOVE_ENCOUNTER, encounterToken, -1, 0L);
    }

    static SessionPlannerMainViewInputEvent moveEncounterUp(long encounterToken) {
        return new SessionPlannerMainViewInputEvent(Kind.MOVE_ENCOUNTER_UP, encounterToken, -1, 0L);
    }

    static SessionPlannerMainViewInputEvent moveEncounterDown(long encounterToken) {
        return new SessionPlannerMainViewInputEvent(Kind.MOVE_ENCOUNTER_DOWN, encounterToken, -1, 0L);
    }

    static SessionPlannerMainViewInputEvent setShortRest(int gapIndex) {
        return new SessionPlannerMainViewInputEvent(Kind.SET_SHORT_REST, 0L, gapIndex, 0L);
    }

    static SessionPlannerMainViewInputEvent setLongRest(int gapIndex) {
        return new SessionPlannerMainViewInputEvent(Kind.SET_LONG_REST, 0L, gapIndex, 0L);
    }

    static SessionPlannerMainViewInputEvent clearRest(int gapIndex) {
        return new SessionPlannerMainViewInputEvent(Kind.CLEAR_REST, 0L, gapIndex, 0L);
    }

    static SessionPlannerMainViewInputEvent addLootPlaceholder() {
        return new SessionPlannerMainViewInputEvent(Kind.ADD_LOOT_PLACEHOLDER, 0L, -1, 0L);
    }

    static SessionPlannerMainViewInputEvent removeLootPlaceholder(long lootToken) {
        return new SessionPlannerMainViewInputEvent(Kind.REMOVE_LOOT_PLACEHOLDER, 0L, -1, lootToken);
    }

    enum Kind {
        REMOVE_ENCOUNTER,
        MOVE_ENCOUNTER_UP,
        MOVE_ENCOUNTER_DOWN,
        SET_SHORT_REST,
        SET_LONG_REST,
        CLEAR_REST,
        ADD_LOOT_PLACEHOLDER,
        REMOVE_LOOT_PLACEHOLDER
    }
}
