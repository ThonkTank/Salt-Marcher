package src.domain.encounter.published;

import java.util.List;
import src.domain.encounter.session.value.EncounterSessionValues;

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
        MUTATE_HP
    }

    public static final class InitiativeValue {

        private final EncounterSessionValues.InitiativeInput input;

        public InitiativeValue(String id, int initiative) {
            this(new EncounterSessionValues.InitiativeInput(id, initiative));
        }

        public InitiativeValue(EncounterSessionValues.InitiativeInput input) {
            this.input = input == null ? new EncounterSessionValues.InitiativeInput("", 0) : input;
        }

        public static InitiativeValue fromInput(EncounterSessionValues.InitiativeInput input) {
            return new InitiativeValue(input);
        }

        public EncounterSessionValues.InitiativeInput toInternal() {
            return input;
        }

        public String id() {
            return input.id();
        }

        public int initiative() {
            return input.initiative();
        }
    }
}
