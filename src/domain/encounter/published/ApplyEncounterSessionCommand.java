package src.domain.encounter.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record ApplyEncounterSessionCommand(
        Action action,
        @Nullable GenerateEncounterCommand generation,
        EncounterSessionSnapshot.BuilderInputs builderInputs,
        long creatureId,
        long planId,
        int delta,
        long token,
        List<EncounterSessionSnapshot.InitiativeInput> initiativeInputs,
        String combatantId,
        int initiative,
        long partyMemberId,
        int amount,
        boolean healing
) {
    public ApplyEncounterSessionCommand {
        action = action == null ? Action.REFRESH : action;
        builderInputs = builderInputs == null ? EncounterSessionSnapshot.BuilderInputs.empty() : builderInputs;
        initiativeInputs = initiativeInputs == null ? List.of() : List.copyOf(initiativeInputs);
        combatantId = combatantId == null ? "" : combatantId;
    }

    public enum Action {
        REFRESH,
        UPDATE_BUILDER_INPUTS,
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
}
