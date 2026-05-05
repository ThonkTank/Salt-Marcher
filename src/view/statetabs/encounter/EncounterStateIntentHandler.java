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
        EncounterBuilderStateViewInputEvent.Interaction interaction = event.interaction();
        if (interaction instanceof EncounterBuilderStateViewInputEvent.GeneratorInteraction generator) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.BuilderMutation(
                    new EncounterStatePublishedEvent.GeneratorMutation(
                            generator.generateRequested(),
                            generator.alternativeShift()))));
            return;
        }
        if (interaction instanceof EncounterBuilderStateViewInputEvent.PlanInteraction plan) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.BuilderMutation(
                    new EncounterStatePublishedEvent.PlanMutation(
                            plan.saveCurrentPlanRequested(),
                            plan.selectedPlanId()))));
            return;
        }
        if (interaction instanceof EncounterBuilderStateViewInputEvent.RosterInteraction roster) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.BuilderMutation(
                    new EncounterStatePublishedEvent.RosterMutation(
                            roster.creatureId(),
                            roster.delta(),
                            roster.removalRequested()))));
            return;
        }
        if (interaction instanceof EncounterBuilderStateViewInputEvent.UndoInteraction undo) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.BuilderMutation(
                    new EncounterStatePublishedEvent.UndoMutation(undo.token()))));
            return;
        }
        if (interaction instanceof EncounterBuilderStateViewInputEvent.DetailInteraction detail) {
            presentationModel.selectCreatureDetail(detail.creatureId());
            return;
        }
        if (interaction instanceof EncounterBuilderStateViewInputEvent.BuilderActionInteraction builderAction) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.BuilderMutation(
                    new EncounterStatePublishedEvent.BuilderActionMutation(
                            builderAction.clearHistoryRequested(),
                            builderAction.startInitiativeRequested()))));
        }
    }

    void consume(EncounterInitiativeStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.interaction() instanceof EncounterInitiativeStateViewInputEvent.BackNavigationInteraction) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.InitiativeSubmission(true, List.of())));
            return;
        }
        if (event.interaction() instanceof EncounterInitiativeStateViewInputEvent.SubmissionInteraction submissionInteraction) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.InitiativeSubmission(
                    false,
                    submissionInteraction.initiatives().stream()
                        .map(entry -> new EncounterStatePublishedEvent.InitiativeEntry(entry.id(), entry.initiative()))
                        .toList())));
        }
    }

    void consume(EncounterCombatStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        EncounterCombatStateViewInputEvent.Interaction interaction = event.interaction();
        if (interaction instanceof EncounterCombatStateViewInputEvent.AdvanceTurnInteraction) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.CombatMutation(
                    new EncounterStatePublishedEvent.AdvanceTurnMutation())));
            return;
        }
        if (interaction instanceof EncounterCombatStateViewInputEvent.HpChangeInteraction hpChange) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.CombatMutation(
                    new EncounterStatePublishedEvent.HpMutation(
                            hpChange.combatantId(),
                            hpChange.amount(),
                            hpChange.healing()))));
            return;
        }
        if (interaction instanceof EncounterCombatStateViewInputEvent.InitiativeEditInteraction initiativeEdit) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.CombatMutation(
                    new EncounterStatePublishedEvent.InitiativeAdjustment(
                            initiativeEdit.combatantId(),
                            initiativeEdit.initiativeValue()))));
            return;
        }
        if (interaction instanceof EncounterCombatStateViewInputEvent.PartyMemberJoinInteraction partyMemberJoin) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.CombatMutation(
                    new EncounterStatePublishedEvent.PartyMemberAddition(
                            partyMemberJoin.partyMemberId(),
                            partyMemberJoin.initiativeValue()))));
            return;
        }
        if (interaction instanceof EncounterCombatStateViewInputEvent.EndCombatInteraction) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.CombatMutation(
                    new EncounterStatePublishedEvent.EndCombatMutation())));
        }
    }

    void consume(EncounterResultsStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.interaction() instanceof EncounterResultsStateViewInputEvent.AwardInteraction) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.ResultMutation(
                    new EncounterStatePublishedEvent.AwardXpMutation())));
            return;
        }
        if (event.interaction() instanceof EncounterResultsStateViewInputEvent.ReturnInteraction) {
            publish(new EncounterStatePublishedEvent(new EncounterStatePublishedEvent.ResultMutation(
                    new EncounterStatePublishedEvent.ReturnToBuilderMutation())));
        }
    }

    private void publish(EncounterStatePublishedEvent event) {
        publishedEventListener.accept(Objects.requireNonNull(event, "event"));
    }
}
