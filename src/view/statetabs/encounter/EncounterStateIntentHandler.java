package src.view.statetabs.encounter;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

final class EncounterStateIntentHandler {

    private Consumer<EncounterStatePublishedEvent> publishedEventListener = ignored -> { };

    EncounterStateIntentHandler(EncounterStateContributionModel presentationModel) {
        Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onPublishedEventRequested(Consumer<EncounterStatePublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> { } : listener;
    }

    void consume(EncounterBuilderStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.generateRequested()) {
            publish(EncounterStatePublishedEvent.Action.GENERATE, event.creatureId(), event.openedPlanId(),
                    0, event.undoToken(), List.of(), "", 0, 0L, 0, false);
            return;
        }
        if (event.alternativeShift() != 0) {
            publish(EncounterStatePublishedEvent.Action.SHIFT_ALTERNATIVE, event.creatureId(),
                    event.openedPlanId(), event.alternativeShift(), event.undoToken(), List.of(), "", 0, 0L, 0, false);
            return;
        }
        if (event.saveRequested()) {
            publish(EncounterStatePublishedEvent.Action.SAVE_CURRENT_PLAN, event.creatureId(), event.openedPlanId(),
                    0, event.undoToken(), List.of(), "", 0, 0L, 0, false);
            return;
        }
        if (event.openedPlanId() > 0L) {
            publish(EncounterStatePublishedEvent.Action.APPLY_SAVED_PLAN, event.creatureId(), event.openedPlanId(),
                    0, event.undoToken(), List.of(), "", 0, 0L, 0, false);
            return;
        }
        if (event.clearHistoryRequested()) {
            publish(EncounterStatePublishedEvent.Action.CLEAR_GENERATION_HISTORY, event.creatureId(),
                    event.openedPlanId(), 0, event.undoToken(), List.of(), "", 0, 0L, 0, false);
            return;
        }
        if (event.rosterDelta() > 0) {
            publish(EncounterStatePublishedEvent.Action.INCREMENT_CREATURE, event.creatureId(),
                    event.openedPlanId(), 0, event.undoToken(), List.of(), "", 0, 0L, 0, false);
            return;
        }
        if (event.rosterDelta() < 0) {
            publish(EncounterStatePublishedEvent.Action.DECREMENT_CREATURE, event.creatureId(),
                    event.openedPlanId(), 0, event.undoToken(), List.of(), "", 0, 0L, 0, false);
            return;
        }
        if (event.creatureRemovalRequested()) {
            publish(EncounterStatePublishedEvent.Action.REMOVE_CREATURE, event.creatureId(),
                    event.openedPlanId(), 0, event.undoToken(), List.of(), "", 0, 0L, 0, false);
            return;
        }
        if (event.undoToken() > 0L) {
            publish(EncounterStatePublishedEvent.Action.UNDO_REMOVE, event.creatureId(), event.openedPlanId(),
                    0, event.undoToken(), List.of(), "", 0, 0L, 0, false);
            return;
        }
        if (event.startInitiativeRequested()) {
            publish(EncounterStatePublishedEvent.Action.START_INITIATIVE, event.creatureId(),
                    event.openedPlanId(), 0, event.undoToken(), List.of(), "", 0, 0L, 0, false);
        }
    }

    void consume(EncounterInitiativeStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.backRequested()) {
            publish(EncounterStatePublishedEvent.Action.BACK_TO_BUILDER, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
            return;
        }
        publish(
                EncounterStatePublishedEvent.Action.CONFIRM_INITIATIVE,
                0L,
                0L,
                0,
                0L,
                event.initiatives().stream()
                        .map(entry -> new EncounterStatePublishedEvent.InitiativeEntry(entry.id(), entry.initiative()))
                        .toList(),
                "",
                0,
                0L,
                0,
                false);
    }

    void consume(EncounterCombatStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.nextTurnRequested()) {
            publish(EncounterStatePublishedEvent.Action.ADVANCE_TURN, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
            return;
        }
        if (event.hpDelta() != 0) {
            publish(EncounterStatePublishedEvent.Action.MUTATE_HP, 0L, 0L, event.hpDelta(), 0L, List.of(),
                    event.combatantId(), 0, 0L, event.hpDelta(), event.healing());
            return;
        }
        if (event.initiativeChangeRequested()) {
            publish(EncounterStatePublishedEvent.Action.SET_INITIATIVE, 0L, 0L, 0, 0L, List.of(),
                    event.combatantId(), event.initiativeValue(), 0L, 0, false);
            return;
        }
        if (event.partyMemberId() > 0L) {
            publish(EncounterStatePublishedEvent.Action.ADD_PARTY_MEMBER_TO_COMBAT, 0L, 0L, 0, 0L, List.of(),
                    "", event.initiativeValue(), event.partyMemberId(), 0, false);
            return;
        }
        if (event.endCombatRequested()) {
            publish(EncounterStatePublishedEvent.Action.END_COMBAT, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
        }
    }

    void consume(EncounterResultsStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.awardRequested()) {
            publish(EncounterStatePublishedEvent.Action.AWARD_XP, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
            return;
        }
        if (event.returnToBuilderRequested()) {
            publish(
                    EncounterStatePublishedEvent.Action.RETURN_TO_BUILDER_AFTER_RESULTS,
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
    }

    private void publish(
            EncounterStatePublishedEvent.Action action,
            long creatureId,
            long selectedPlanId,
            int delta,
            long undoToken,
            List<EncounterStatePublishedEvent.InitiativeEntry> initiatives,
            String combatantId,
            int initiativeValue,
            long partyMemberId,
            int amount,
            boolean healing
    ) {
        publishedEventListener.accept(new EncounterStatePublishedEvent(
                action,
                creatureId,
                selectedPlanId,
                delta,
                undoToken,
                initiatives,
                combatantId,
                initiativeValue,
                partyMemberId,
                amount,
                healing));
    }
}
