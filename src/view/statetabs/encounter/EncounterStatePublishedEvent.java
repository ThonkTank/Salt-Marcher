package src.view.statetabs.encounter;

import java.util.List;

public record EncounterStatePublishedEvent(
        Action action,
        long creatureId,
        long savedPlanId,
        int delta,
        long undoToken,
        List<InitiativeEntry> initiatives,
        String combatantId,
        int initiative,
        long partyMemberId,
        int amount,
        boolean healing
) {

    public EncounterStatePublishedEvent {
        action = action == null ? Action.REFRESH : action;
        initiatives = initiatives == null ? List.of() : List.copyOf(initiatives);
        combatantId = combatantId == null ? "" : combatantId;
    }

    enum Action {
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
        SET_INITIATIVE,
        ADD_PARTY_MEMBER_TO_COMBAT,
        END_COMBAT,
        AWARD_XP,
        RETURN_TO_BUILDER_AFTER_RESULTS,
        MUTATE_HP
    }

    public record InitiativeEntry(String id, int initiative) {

        public InitiativeEntry {
            id = id == null ? "" : id;
        }
    }
}
