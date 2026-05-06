package src.domain.encounter.application;

import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.session.value.EncounterSessionCommand;
import src.domain.encounter.session.value.EncounterSessionValues.InitiativeInput;

public final class EncounterStateBoundaryTranslator {

    private EncounterStateBoundaryTranslator() {
    }

    public static EncounterSessionCommand toInternalCommand(@Nullable ApplyEncounterStateCommand command) {
        if (command == null) {
            return EncounterSessionCommand.refresh();
        }
        return new EncounterSessionCommand(
                toInternalAction(command.action()),
                Optional.empty(),
                EncounterBuilderInputsBoundaryTranslator.toInternal(null),
                command.creatureId(),
                command.planId(),
                command.delta(),
                command.undoToken(),
                toInternalInitiatives(command.initiativeValues()),
                command.combatantId(),
                command.initiative(),
                command.partyMemberId(),
                command.amount(),
                command.healing());
    }

    private static EncounterSessionCommand.Action toInternalAction(ApplyEncounterStateCommand.Action action) {
        ApplyEncounterStateCommand.Action effective = action == null ? ApplyEncounterStateCommand.Action.REFRESH : action;
        return switch (effective) {
            case REFRESH -> EncounterSessionCommand.Action.REFRESH;
            case GENERATE -> EncounterSessionCommand.Action.GENERATE;
            case SAVE_CURRENT_PLAN -> EncounterSessionCommand.Action.SAVE_CURRENT_PLAN;
            case OPEN_SAVED_PLAN -> EncounterSessionCommand.Action.OPEN_SAVED_PLAN;
            case CLEAR_GENERATION_HISTORY -> EncounterSessionCommand.Action.CLEAR_GENERATION_HISTORY;
            case SHIFT_ALTERNATIVE -> EncounterSessionCommand.Action.SHIFT_ALTERNATIVE;
            case ADD_CREATURE -> EncounterSessionCommand.Action.ADD_CREATURE;
            case INCREMENT_CREATURE -> EncounterSessionCommand.Action.INCREMENT_CREATURE;
            case DECREMENT_CREATURE -> EncounterSessionCommand.Action.DECREMENT_CREATURE;
            case REMOVE_CREATURE -> EncounterSessionCommand.Action.REMOVE_CREATURE;
            case UNDO_REMOVE -> EncounterSessionCommand.Action.UNDO_REMOVE;
            case OPEN_INITIATIVE -> EncounterSessionCommand.Action.OPEN_INITIATIVE;
            case BACK_TO_BUILDER -> EncounterSessionCommand.Action.BACK_TO_BUILDER;
            case CONFIRM_INITIATIVE -> EncounterSessionCommand.Action.CONFIRM_INITIATIVE;
            case ADVANCE_TURN -> EncounterSessionCommand.Action.ADVANCE_TURN;
            case ADJUST_INITIATIVE -> EncounterSessionCommand.Action.ADJUST_INITIATIVE;
            case ADD_PARTY_MEMBER_TO_COMBAT -> EncounterSessionCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT;
            case END_COMBAT -> EncounterSessionCommand.Action.END_COMBAT;
            case AWARD_XP -> EncounterSessionCommand.Action.AWARD_XP;
            case RETURN_TO_BUILDER_AFTER_RESULTS -> EncounterSessionCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS;
            case MUTATE_HP -> EncounterSessionCommand.Action.MUTATE_HP;
        };
    }

    private static List<InitiativeInput> toInternalInitiatives(List<ApplyEncounterStateCommand.InitiativeValue> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .map(value -> new InitiativeInput(value.id(), value.initiative()))
                .toList();
    }
}
