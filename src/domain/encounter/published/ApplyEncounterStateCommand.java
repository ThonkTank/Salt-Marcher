package src.domain.encounter.published;

import java.util.List;

public record ApplyEncounterStateCommand(
        Action action,
        long creatureId,
        long planId,
        int delta,
        long undoToken,
        List<InitiativeValue> initiativeValues,
        String combatantId,
        int initiative,
        long partyMemberId,
        int amount,
        boolean healing
) {

    public ApplyEncounterStateCommand {
        action = action == null ? Action.REFRESH : action;
        creatureId = Math.max(0L, creatureId);
        planId = Math.max(0L, planId);
        undoToken = Math.max(0L, undoToken);
        initiativeValues = initiativeValues == null ? List.of() : List.copyOf(initiativeValues);
        combatantId = combatantId == null ? "" : combatantId;
        partyMemberId = Math.max(0L, partyMemberId);
        amount = Math.max(0, amount);
    }

    public static ApplyEncounterStateCommand action(String actionKey) {
        return create(actionKey, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    public static ApplyEncounterStateCommand creature(String actionKey, long creatureId) {
        return create(actionKey, creatureId, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    public static ApplyEncounterStateCommand plan(String actionKey, long planId) {
        return create(actionKey, 0L, planId, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    public static ApplyEncounterStateCommand delta(String actionKey, int delta) {
        return create(actionKey, 0L, 0L, delta, 0L, List.of(), "", 0, 0L, 0, false);
    }

    public static ApplyEncounterStateCommand undo(String actionKey, long undoToken) {
        return create(actionKey, 0L, 0L, 0, undoToken, List.of(), "", 0, 0L, 0, false);
    }

    public static ApplyEncounterStateCommand initiatives(
            String actionKey,
            List<String> ids,
            List<Integer> initiatives
    ) {
        return create(actionKey, 0L, 0L, 0, 0L, initiativeValues(ids, initiatives), "", 0, 0L, 0, false);
    }

    public static ApplyEncounterStateCommand hitPoints(
            String actionKey,
            String combatantId,
            int amount,
            boolean healing
    ) {
        return create(actionKey, 0L, 0L, 0, 0L, List.of(), combatantId, 0, 0L, amount, healing);
    }

    public static ApplyEncounterStateCommand initiative(String actionKey, String combatantId, int initiative) {
        return create(actionKey, 0L, 0L, 0, 0L, List.of(), combatantId, initiative, 0L, 0, false);
    }

    public static ApplyEncounterStateCommand partyMember(String actionKey, long partyMemberId, int initiative) {
        return create(actionKey, 0L, 0L, 0, 0L, List.of(), "", initiative, partyMemberId, 0, false);
    }

    public static ApplyEncounterStateCommand create(
            String actionKey,
            long creatureId,
            long planId,
            int delta,
            long undoToken,
            List<InitiativeValue> initiativeValues,
            String combatantId,
            int initiative,
            long partyMemberId,
            int amount,
            boolean healing
    ) {
        return new ApplyEncounterStateCommand(
                actionFromKey(actionKey),
                creatureId,
                planId,
                delta,
                undoToken,
                initiativeValues,
                combatantId,
                initiative,
                partyMemberId,
                amount,
                healing);
    }

    private static Action actionFromKey(String actionKey) {
        if (actionKey == null || actionKey.isBlank()) {
            throw new IllegalArgumentException("actionKey must name an encounter action");
        }
        return Action.valueOf(actionKey);
    }

    private static List<InitiativeValue> initiativeValues(List<String> ids, List<Integer> initiatives) {
        List<String> safeIds = ids == null ? List.of() : List.copyOf(ids);
        List<Integer> safeInitiatives = initiatives == null ? List.of() : List.copyOf(initiatives);
        int count = Math.min(safeIds.size(), safeInitiatives.size());
        java.util.ArrayList<InitiativeValue> values = new java.util.ArrayList<>();
        for (int index = 0; index < count; index++) {
            values.add(new InitiativeValue(safeIds.get(index), safeInitiatives.get(index)));
        }
        return List.copyOf(values);
    }

    public enum Action {
        REFRESH,
        GENERATE,
        SAVE_CURRENT_PLAN,
        OPEN_SAVED_PLAN,
        CLEAR_GENERATION_HISTORY,
        SHIFT_ALTERNATIVE,
        ADD_CREATURE,
        INCREMENT_CREATURE,
        DECREMENT_CREATURE,
        REMOVE_CREATURE,
        UNDO_REMOVE,
        OPEN_INITIATIVE,
        BACK_TO_BUILDER,
        CONFIRM_INITIATIVE,
        ADVANCE_TURN,
        ADJUST_INITIATIVE,
        ADD_PARTY_MEMBER_TO_COMBAT,
        END_COMBAT,
        AWARD_XP,
        RETURN_TO_BUILDER_AFTER_RESULTS,
        MUTATE_HP;

        public boolean republishesSavedPlans() {
            return this == REFRESH
                    || this == OPEN_SAVED_PLAN
                    || this == SAVE_CURRENT_PLAN;
        }
    }

    public record InitiativeValue(
            String id,
            int initiative
    ) {
        public InitiativeValue {
            id = id == null ? "" : id;
        }
    }
}
