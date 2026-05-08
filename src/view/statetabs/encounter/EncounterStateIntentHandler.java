package src.view.statetabs.encounter;

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
        switch (event.interaction()) {
            case EncounterBuilderStateViewInputEvent.GenerateInput ignored ->
                    publish(new EncounterStatePublishedEvent.GenerateMutation());
            case EncounterBuilderStateViewInputEvent.ShiftAlternativeInput shift ->
                    publish(new EncounterStatePublishedEvent.ShiftAlternativeMutation(shift.alternativeShift()));
            case EncounterBuilderStateViewInputEvent.SaveCurrentPlanInput ignored ->
                    publish(new EncounterStatePublishedEvent.SaveCurrentPlanMutation());
            case EncounterBuilderStateViewInputEvent.OpenSavedPlanInput openPlan ->
                    publish(new EncounterStatePublishedEvent.OpenSavedPlanMutation(openPlan.selectedPlanId()));
            case EncounterBuilderStateViewInputEvent.ChangeRosterCountInput rosterChange -> {
                if (rosterChange.delta() > 0) {
                    publish(new EncounterStatePublishedEvent.IncrementCreatureMutation(rosterChange.creatureId()));
                } else {
                    publish(new EncounterStatePublishedEvent.DecrementCreatureMutation(rosterChange.creatureId()));
                }
            }
            case EncounterBuilderStateViewInputEvent.RemoveCreatureInput removal ->
                    publish(new EncounterStatePublishedEvent.RemoveCreatureMutation(removal.creatureId()));
            case EncounterBuilderStateViewInputEvent.UndoRemoveInput undo ->
                    publish(new EncounterStatePublishedEvent.UndoRemoveMutation(undo.undoToken()));
            case EncounterBuilderStateViewInputEvent.ClearGenerationHistoryInput ignored ->
                    publish(new EncounterStatePublishedEvent.ClearGenerationHistoryMutation());
            case EncounterBuilderStateViewInputEvent.OpenInitiativeInput ignored ->
                    publish(new EncounterStatePublishedEvent.OpenInitiativeMutation());
            case EncounterBuilderStateViewInputEvent.OpenCreatureDetailInput detail ->
                    presentationModel.selectCreatureDetail(detail.creatureId());
        }
    }

    void consume(EncounterInitiativeStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.backToBuilder()) {
            publish(new EncounterStatePublishedEvent.BackToBuilderMutation());
            return;
        }
        publish(new EncounterStatePublishedEvent.ConfirmInitiativeMutation(event.initiatives().stream()
                .map(entry -> new EncounterStatePublishedEvent.InitiativeValue(entry.id(), entry.initiative()))
                .toList()));
    }

    void consume(EncounterCombatStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.interaction()) {
            case EncounterCombatStateViewInputEvent.AdvanceTurnInput ignored ->
                    publish(new EncounterStatePublishedEvent.AdvanceTurnMutation());
            case EncounterCombatStateViewInputEvent.EndCombatInput ignored ->
                    publish(new EncounterStatePublishedEvent.EndCombatMutation());
            case EncounterCombatStateViewInputEvent.HpChangeInput hp ->
                    publish(new EncounterStatePublishedEvent.HpChangeMutation(
                            hp.combatantId(),
                            hp.amount(),
                            hp.healing()));
            case EncounterCombatStateViewInputEvent.InitiativeEditInput initiative ->
                    publish(new EncounterStatePublishedEvent.InitiativeEditMutation(
                            initiative.combatantId(),
                            initiative.initiativeValue()));
            case EncounterCombatStateViewInputEvent.PartyMemberJoinInput partyMember ->
                    publish(new EncounterStatePublishedEvent.PartyMemberJoinMutation(
                            partyMember.partyMemberId(),
                            partyMember.initiativeValue()));
        }
    }

    void consume(EncounterResultsStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.action()) {
            case AWARD_XP -> publish(new EncounterStatePublishedEvent.AwardXpMutation());
            case RETURN_TO_BUILDER -> publish(new EncounterStatePublishedEvent.ReturnToBuilderMutation());
        }
    }

    private void publish(EncounterStatePublishedEvent.Mutation mutation) {
        publishedEventListener.accept(new EncounterStatePublishedEvent(Objects.requireNonNull(mutation, "mutation")));
    }
}
