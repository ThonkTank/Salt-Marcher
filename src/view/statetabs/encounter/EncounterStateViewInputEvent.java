package src.view.statetabs.encounter;

import java.util.List;

public record EncounterStateViewInputEvent(
        Source source,
        long selectedPlanId,
        long creatureId,
        long undoToken,
        List<InitiativeEntry> initiatives,
        String combatantId,
        int amount,
        int initiativeValue,
        long partyMemberId,
        boolean healing
) {

    public EncounterStateViewInputEvent {
        source = source == null ? Source.GENERATE_BUTTON : source;
        selectedPlanId = Math.max(0L, selectedPlanId);
        creatureId = Math.max(0L, creatureId);
        undoToken = Math.max(0L, undoToken);
        initiatives = initiatives == null ? List.of() : List.copyOf(initiatives);
        combatantId = combatantId == null ? "" : combatantId;
        partyMemberId = Math.max(0L, partyMemberId);
    }

    enum Source {
        GENERATE_BUTTON,
        PREVIOUS_ALTERNATIVE_BUTTON,
        NEXT_ALTERNATIVE_BUTTON,
        SAVE_PLAN_BUTTON,
        OPEN_SAVED_PLAN_SELECTION,
        CLEAR_HISTORY_BUTTON,
        ROSTER_INCREMENT_BUTTON,
        ROSTER_DECREMENT_BUTTON,
        ROSTER_REMOVE_BUTTON,
        UNDO_REMOVE_BUTTON,
        OPEN_CREATURE_LINK,
        START_INITIATIVE_BUTTON,
        INITIATIVE_BACK_BUTTON,
        INITIATIVE_CONFIRM_BUTTON,
        NEXT_TURN_BUTTON,
        HIT_POINT_ADJUSTMENT,
        INITIATIVE_VALUE_SUBMIT,
        ADD_PARTY_MEMBER_SELECTION,
        END_COMBAT_CONFIRM_BUTTON,
        AWARD_XP_BUTTON,
        RETURN_TO_BUILDER_BUTTON
    }

    public record InitiativeEntry(String id, int initiative) {
    }
}
