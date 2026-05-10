package src.view.statetabs.encounter;

import java.util.List;
import java.util.Objects;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterStateCommand;

final class EncounterStateIntentHandler {

    private final EncounterStateContributionModel presentationModel;
    private final EncounterApplicationService encounters;

    EncounterStateIntentHandler(
            EncounterStateContributionModel presentationModel,
            EncounterApplicationService encounters
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
    }

    void consume(EncounterBuilderStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.builderInput()) {
            case EncounterBuilderStateViewInputEvent.GenerateInput ignored ->
                    apply(command(ApplyEncounterStateCommand.Action.GENERATE));
            case EncounterBuilderStateViewInputEvent.ShiftAlternativeInput shift ->
                    apply(command(ApplyEncounterStateCommand.Action.SHIFT_ALTERNATIVE, shift.alternativeShift()));
            case EncounterBuilderStateViewInputEvent.SaveCurrentPlanInput ignored ->
                    apply(command(ApplyEncounterStateCommand.Action.SAVE_CURRENT_PLAN));
            case EncounterBuilderStateViewInputEvent.OpenSavedPlanInput openPlan ->
                    apply(command(ApplyEncounterStateCommand.Action.OPEN_SAVED_PLAN, openPlan.selectedPlanId()));
            case EncounterBuilderStateViewInputEvent.ChangeRosterCountInput rosterChange -> {
                if (rosterChange.delta() > 0) {
                    apply(command(ApplyEncounterStateCommand.Action.INCREMENT_CREATURE, rosterChange.creatureId()));
                } else {
                    apply(command(ApplyEncounterStateCommand.Action.DECREMENT_CREATURE, rosterChange.creatureId()));
                }
            }
            case EncounterBuilderStateViewInputEvent.RemoveCreatureInput removal ->
                    apply(command(ApplyEncounterStateCommand.Action.REMOVE_CREATURE, removal.creatureId()));
            case EncounterBuilderStateViewInputEvent.UndoRemoveInput undo ->
                    apply(command(ApplyEncounterStateCommand.Action.UNDO_REMOVE, undo.undoToken()));
            case EncounterBuilderStateViewInputEvent.ClearGenerationHistoryInput ignored ->
                    apply(command(ApplyEncounterStateCommand.Action.CLEAR_GENERATION_HISTORY));
            case EncounterBuilderStateViewInputEvent.OpenInitiativeInput ignored ->
                    apply(command(ApplyEncounterStateCommand.Action.OPEN_INITIATIVE));
            case EncounterBuilderStateViewInputEvent.OpenCreatureDetailInput detail ->
                    presentationModel.selectCreatureDetail(detail.creatureId());
        }
    }

    void consume(EncounterInitiativeStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.backToBuilder()) {
            apply(command(ApplyEncounterStateCommand.Action.BACK_TO_BUILDER));
            return;
        }
        apply(new ApplyEncounterStateCommand(
                ApplyEncounterStateCommand.Action.CONFIRM_INITIATIVE,
                0L,
                0L,
                0,
                0L,
                event.initiatives().stream()
                        .map(entry -> new ApplyEncounterStateCommand.InitiativeValue(
                                entry.id(),
                                entry.initiative()))
                        .toList(),
                "",
                0,
                0L,
                0,
                false));
    }

    void consume(EncounterCombatStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.combatInput()) {
            case EncounterCombatStateViewInputEvent.AdvanceTurnInput ignored ->
                    apply(command(ApplyEncounterStateCommand.Action.ADVANCE_TURN));
            case EncounterCombatStateViewInputEvent.EndCombatInput ignored ->
                    apply(command(ApplyEncounterStateCommand.Action.END_COMBAT));
            case EncounterCombatStateViewInputEvent.HpChangeInput hp ->
                    apply(new ApplyEncounterStateCommand(
                            ApplyEncounterStateCommand.Action.MUTATE_HP,
                            0L,
                            0L,
                            0,
                            0L,
                            List.of(),
                            hp.combatantId(),
                            0,
                            0L,
                            hp.amount(),
                            hp.healing()));
            case EncounterCombatStateViewInputEvent.InitiativeEditInput initiative ->
                    apply(new ApplyEncounterStateCommand(
                            ApplyEncounterStateCommand.Action.ADJUST_INITIATIVE,
                            0L,
                            0L,
                            0,
                            0L,
                            List.of(),
                            initiative.combatantId(),
                            initiative.initiativeValue(),
                            0L,
                            0,
                            false));
            case EncounterCombatStateViewInputEvent.PartyMemberJoinInput partyMember ->
                    apply(new ApplyEncounterStateCommand(
                            ApplyEncounterStateCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT,
                            0L,
                            0L,
                            0,
                            0L,
                            List.of(),
                            "",
                            partyMember.initiativeValue(),
                            partyMember.partyMemberId(),
                            0,
                            false));
        }
    }

    void consume(EncounterResultsStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.awardExperienceRequested()) {
            apply(command(ApplyEncounterStateCommand.Action.AWARD_XP));
            return;
        }
        apply(command(ApplyEncounterStateCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS));
    }

    private void apply(ApplyEncounterStateCommand command) {
        encounters.applyState(Objects.requireNonNull(command, "command"));
    }

    private static ApplyEncounterStateCommand command(ApplyEncounterStateCommand.Action action) {
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

    private static ApplyEncounterStateCommand command(
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

    private static ApplyEncounterStateCommand command(
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
