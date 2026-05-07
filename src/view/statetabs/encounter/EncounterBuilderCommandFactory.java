package src.view.statetabs.encounter;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.published.ApplyEncounterStateCommand;

final class EncounterBuilderCommandFactory {

    private EncounterBuilderCommandFactory() {
    }

    static @Nullable ApplyEncounterStateCommand fromMutation(EncounterStatePublishedEvent.Mutation mutation) {
        return switch (mutation) {
            case EncounterStateViewInputEvent.GeneratorAction generator -> generator.generateRequested()
                    ? EncounterStateCommandFactory.command(ApplyEncounterStateCommand.Action.GENERATE)
                    : EncounterStateCommandFactory.command(
                            ApplyEncounterStateCommand.Action.SHIFT_ALTERNATIVE,
                            generator.alternativeShift());
            case EncounterStateViewInputEvent.PlanAction plan -> plan.saveCurrentPlanRequested()
                    ? EncounterStateCommandFactory.command(ApplyEncounterStateCommand.Action.SAVE_CURRENT_PLAN)
                    : EncounterStateCommandFactory.command(
                            ApplyEncounterStateCommand.Action.OPEN_SAVED_PLAN,
                            plan.selectedPlanId());
            case EncounterStateViewInputEvent.RosterAction roster -> roster.removalRequested()
                    ? EncounterStateCommandFactory.command(ApplyEncounterStateCommand.Action.REMOVE_CREATURE, roster.creatureId())
                    : roster.delta() > 0
                            ? EncounterStateCommandFactory.command(ApplyEncounterStateCommand.Action.INCREMENT_CREATURE, roster.creatureId())
                            : EncounterStateCommandFactory.command(ApplyEncounterStateCommand.Action.DECREMENT_CREATURE, roster.creatureId());
            case EncounterStateViewInputEvent.UndoAction undoMutation ->
                    EncounterStateCommandFactory.command(ApplyEncounterStateCommand.Action.UNDO_REMOVE, undoMutation.undo().token());
            case EncounterStateViewInputEvent.BuilderModeAction builderAction -> builderAction.clearHistoryRequested()
                    ? EncounterStateCommandFactory.command(ApplyEncounterStateCommand.Action.CLEAR_GENERATION_HISTORY)
                    : EncounterStateCommandFactory.command(ApplyEncounterStateCommand.Action.OPEN_INITIATIVE);
            default -> null;
        };
    }
}
