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
        ApplyEncounterStateCommand.Action effective = action == null
                ? ApplyEncounterStateCommand.Action.REFRESH
                : action;
        return EncounterSessionCommand.Action.valueOf(effective.name());
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
