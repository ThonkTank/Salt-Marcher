package src.domain.sessionplanner.published;

public record ApplySessionPlannerCommand(
        Action action,
        long encounterPlanId,
        long encounterToken,
        int gapIndex,
        SessionPlannerRestKind restKind,
        long lootToken
) {

    public ApplySessionPlannerCommand {
        action = action == null ? Action.REFRESH : action;
        encounterPlanId = Math.max(0L, encounterPlanId);
        encounterToken = Math.max(0L, encounterToken);
        gapIndex = Math.max(-1, gapIndex);
        restKind = restKind == null ? SessionPlannerRestKind.NONE : restKind;
        lootToken = Math.max(0L, lootToken);
    }

    public enum Action {
        REFRESH,
        IMPORT_ENCOUNTER_PLAN,
        REMOVE_ENCOUNTER,
        MOVE_ENCOUNTER_UP,
        MOVE_ENCOUNTER_DOWN,
        SET_REST_GAP,
        CLEAR_REST_GAP,
        ADD_LOOT_PLACEHOLDER,
        REMOVE_LOOT_PLACEHOLDER
    }
}
