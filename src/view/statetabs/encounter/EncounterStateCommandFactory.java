package src.view.statetabs.encounter;

import java.util.List;
import src.domain.encounter.published.ApplyEncounterStateCommand;

final class EncounterStateCommandFactory {

    private EncounterStateCommandFactory() {
    }

    static ApplyEncounterStateCommand fromPublishedEvent(EncounterStatePublishedEvent event) {
        if (event == null) {
            return command(ApplyEncounterStateCommand.Action.REFRESH);
        }
        EncounterStatePublishedEvent.Mutation mutation = event.mutation();
        ApplyEncounterStateCommand command = EncounterBuilderCommandFactory.fromMutation(mutation);
        if (command != null) {
            return command;
        }
        command = EncounterCombatCommandFactory.fromInitiativeMutation(mutation);
        if (command != null) {
            return command;
        }
        command = EncounterCombatCommandFactory.fromCombatMutation(mutation);
        if (command != null) {
            return command;
        }
        command = resultCommand(mutation);
        return command == null ? command(ApplyEncounterStateCommand.Action.REFRESH) : command;
    }

    private static ApplyEncounterStateCommand resultCommand(EncounterStatePublishedEvent.Mutation mutation) {
        if (!(mutation instanceof EncounterStateViewInputEvent.ResultInput resultChange)) {
            return null;
        }
        return switch (resultChange.action()) {
            case BACK_TO_BUILDER -> command(ApplyEncounterStateCommand.Action.BACK_TO_BUILDER);
            case AWARD_XP -> command(ApplyEncounterStateCommand.Action.AWARD_XP);
            case RETURN_TO_BUILDER -> command(ApplyEncounterStateCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS);
        };
    }

    static ApplyEncounterStateCommand command(ApplyEncounterStateCommand.Action action) {
        return new ApplyEncounterStateCommand(
                action,
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

    static ApplyEncounterStateCommand command(
            ApplyEncounterStateCommand.Action action,
            int delta
    ) {
        return new ApplyEncounterStateCommand(
                action,
                0L,
                0L,
                delta,
                0L,
                List.of(),
                "",
                0,
                0L,
                0,
                false);
    }

    static ApplyEncounterStateCommand command(
            ApplyEncounterStateCommand.Action action,
            long longValue
    ) {
        return switch (action) {
            case OPEN_SAVED_PLAN -> new ApplyEncounterStateCommand(
                    action,
                    0L,
                    longValue,
                    0,
                    0L,
                    List.of(),
                    "",
                    0,
                    0L,
                    0,
                    false);
            case INCREMENT_CREATURE,
                    DECREMENT_CREATURE,
                    REMOVE_CREATURE -> new ApplyEncounterStateCommand(
                    action,
                    longValue,
                    0L,
                    0,
                    0L,
                    List.of(),
                    "",
                    0,
                    0L,
                    0,
                    false);
            case UNDO_REMOVE -> new ApplyEncounterStateCommand(
                    action,
                    0L,
                    0L,
                    0,
                    longValue,
                    List.of(),
                    "",
                    0,
                    0L,
                    0,
                    false);
            default -> command(action);
        };
    }
}
