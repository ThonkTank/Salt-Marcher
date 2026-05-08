package src.view.statetabs.encounter;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

final class EncounterStateIntentHandler {

    private final EncounterStateContributionModel presentationModel;
    private Consumer<EncounterStatePublishedEvent> publishedEventListener = ignored -> { };

    EncounterStateIntentHandler(EncounterStateContributionModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onPublishedEventRequested(Consumer<EncounterStatePublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> { } : listener;
    }

    void consume(EncounterBuilderStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.builderInput()) {
            case EncounterBuilderStateViewInputEvent.GenerateInput ignored ->
                    publish(new EncounterStatePublishedEvent.BuilderMutation(
                            EncounterStatePublishedEvent.BuilderChange.GENERATE,
                            0L,
                            0));
            case EncounterBuilderStateViewInputEvent.ShiftAlternativeInput shift ->
                    publish(new EncounterStatePublishedEvent.BuilderMutation(
                            EncounterStatePublishedEvent.BuilderChange.SHIFT_ALTERNATIVE,
                            0L,
                            shift.alternativeShift()));
            case EncounterBuilderStateViewInputEvent.SaveCurrentPlanInput ignored ->
                    publish(new EncounterStatePublishedEvent.BuilderMutation(
                            EncounterStatePublishedEvent.BuilderChange.SAVE_CURRENT_PLAN,
                            0L,
                            0));
            case EncounterBuilderStateViewInputEvent.OpenSavedPlanInput openPlan ->
                    publish(new EncounterStatePublishedEvent.BuilderMutation(
                            EncounterStatePublishedEvent.BuilderChange.OPEN_SAVED_PLAN,
                            openPlan.selectedPlanId(),
                            0));
            case EncounterBuilderStateViewInputEvent.ChangeRosterCountInput rosterChange -> {
                if (rosterChange.delta() > 0) {
                    publish(new EncounterStatePublishedEvent.BuilderMutation(
                            EncounterStatePublishedEvent.BuilderChange.INCREMENT_CREATURE,
                            rosterChange.creatureId(),
                            0));
                } else {
                    publish(new EncounterStatePublishedEvent.BuilderMutation(
                            EncounterStatePublishedEvent.BuilderChange.DECREMENT_CREATURE,
                            rosterChange.creatureId(),
                            0));
                }
            }
            case EncounterBuilderStateViewInputEvent.RemoveCreatureInput removal ->
                    publish(new EncounterStatePublishedEvent.BuilderMutation(
                            EncounterStatePublishedEvent.BuilderChange.REMOVE_CREATURE,
                            removal.creatureId(),
                            0));
            case EncounterBuilderStateViewInputEvent.UndoRemoveInput undo ->
                    publish(new EncounterStatePublishedEvent.BuilderMutation(
                            EncounterStatePublishedEvent.BuilderChange.UNDO_REMOVE,
                            undo.undoToken(),
                            0));
            case EncounterBuilderStateViewInputEvent.ClearGenerationHistoryInput ignored ->
                    publish(new EncounterStatePublishedEvent.BuilderMutation(
                            EncounterStatePublishedEvent.BuilderChange.CLEAR_GENERATION_HISTORY,
                            0L,
                            0));
            case EncounterBuilderStateViewInputEvent.OpenInitiativeInput ignored ->
                    publish(new EncounterStatePublishedEvent.BuilderMutation(
                            EncounterStatePublishedEvent.BuilderChange.OPEN_INITIATIVE,
                            0L,
                            0));
            case EncounterBuilderStateViewInputEvent.OpenCreatureDetailInput detail ->
                    presentationModel.selectCreatureDetail(detail.creatureId());
        }
    }

    void consume(EncounterInitiativeStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.backToBuilder()) {
            publish(new EncounterStatePublishedEvent.InitiativeMutation(true, List.of()));
            return;
        }
        publish(new EncounterStatePublishedEvent.InitiativeMutation(false, event.initiatives().stream()
                .map(entry -> new EncounterStatePublishedEvent.SubmittedInitiative(entry.id(), entry.initiative()))
                .toList()));
    }

    void consume(EncounterCombatStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.combatInput()) {
            case EncounterCombatStateViewInputEvent.AdvanceTurnInput ignored ->
                    publish(new EncounterStatePublishedEvent.CombatMutation(
                            EncounterStatePublishedEvent.CombatChange.ADVANCE_TURN,
                            "",
                            0,
                            0L,
                            false));
            case EncounterCombatStateViewInputEvent.EndCombatInput ignored ->
                    publish(new EncounterStatePublishedEvent.CombatMutation(
                            EncounterStatePublishedEvent.CombatChange.END_COMBAT,
                            "",
                            0,
                            0L,
                            false));
            case EncounterCombatStateViewInputEvent.HpChangeInput hp ->
                    publish(new EncounterStatePublishedEvent.CombatMutation(
                            EncounterStatePublishedEvent.CombatChange.MUTATE_HP,
                            hp.combatantId(),
                            hp.amount(),
                            0L,
                            hp.healing()));
            case EncounterCombatStateViewInputEvent.InitiativeEditInput initiative ->
                    publish(new EncounterStatePublishedEvent.CombatMutation(
                            EncounterStatePublishedEvent.CombatChange.ADJUST_INITIATIVE,
                            initiative.combatantId(),
                            initiative.initiativeValue(),
                            0L,
                            false));
            case EncounterCombatStateViewInputEvent.PartyMemberJoinInput partyMember ->
                    publish(new EncounterStatePublishedEvent.CombatMutation(
                            EncounterStatePublishedEvent.CombatChange.ADD_PARTY_MEMBER_TO_COMBAT,
                            "",
                            partyMember.initiativeValue(),
                            partyMember.partyMemberId(),
                            false));
        }
    }

    void consume(EncounterResultsStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.awardExperienceRequested()) {
            publish(new EncounterStatePublishedEvent.ResultMutation(true));
            return;
        }
        publish(new EncounterStatePublishedEvent.ResultMutation(false));
    }

    private void publish(EncounterStatePublishedEvent.Mutation mutation) {
        publishedEventListener.accept(new EncounterStatePublishedEvent(Objects.requireNonNull(mutation, "mutation")));
    }
}
