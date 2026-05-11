package src.domain.encounter.model.session.model;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.generation.model.EncounterGenerationRequest;
import src.domain.encounter.model.session.model.EncounterSessionValues.InitiativeInput;

public record EncounterSessionCommand(
        Action action,
        Optional<EncounterGenerationRequest> generation,
        EncounterGenerationInputs builderInputs,
        long creatureId,
        long planId,
        int delta,
        long token,
        List<InitiativeInput> initiativeInputs,
        String combatantId,
        int initiative,
        long partyMemberId,
        int amount,
        boolean healing
) {
    public EncounterSessionCommand {
        action = action == null ? Action.REFRESH : action;
        generation = generation == null ? Optional.empty() : generation;
        builderInputs = builderInputs == null ? EncounterGenerationInputs.empty() : builderInputs;
        initiativeInputs = initiativeInputs == null ? List.of() : List.copyOf(initiativeInputs);
        combatantId = combatantId == null ? "" : combatantId;
    }

    public static EncounterSessionCommand refresh() {
        return new EncounterSessionCommand(
                Action.REFRESH,
                Optional.empty(),
                EncounterGenerationInputs.empty(),
                0L,
                0L,
                0,
                0L,
                List.of(),
                "",
                0,
                0L,
                0,
                false);
    }

    public static EncounterSessionCommand updateBuilderInputs(EncounterGenerationInputs builderInputs) {
        return new EncounterSessionCommand(
                Action.UPDATE_BUILDER_INPUTS,
                Optional.empty(),
                builderInputs,
                0L,
                0L,
                0,
                0L,
                List.of(),
                "",
                0,
                0L,
                0,
                false);
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
        ADJUST_INITIATIVE,
        ADD_PARTY_MEMBER_TO_COMBAT,
        END_COMBAT,
        AWARD_XP,
        RETURN_TO_BUILDER_AFTER_RESULTS,
        MUTATE_HP
    }
}
