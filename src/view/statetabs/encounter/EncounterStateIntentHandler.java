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

    void consume(EncounterStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.source()) {
            case GENERATE_BUTTON -> publish(EncounterStatePublishedEvent.Action.GENERATE, event);
            case PREVIOUS_ALTERNATIVE_BUTTON -> publish(EncounterStatePublishedEvent.Action.SHIFT_ALTERNATIVE, event, -1);
            case NEXT_ALTERNATIVE_BUTTON -> publish(EncounterStatePublishedEvent.Action.SHIFT_ALTERNATIVE, event, 1);
            case SAVE_PLAN_BUTTON -> publish(EncounterStatePublishedEvent.Action.SAVE_CURRENT_PLAN, event);
            case OPEN_SAVED_PLAN_SELECTION -> publish(EncounterStatePublishedEvent.Action.OPEN_SAVED_PLAN, event);
            case CLEAR_HISTORY_BUTTON -> publish(EncounterStatePublishedEvent.Action.CLEAR_GENERATION_HISTORY, event);
            case ROSTER_INCREMENT_BUTTON -> publish(EncounterStatePublishedEvent.Action.INCREMENT_CREATURE, event);
            case ROSTER_DECREMENT_BUTTON -> publish(EncounterStatePublishedEvent.Action.DECREMENT_CREATURE, event);
            case ROSTER_REMOVE_BUTTON -> publish(EncounterStatePublishedEvent.Action.REMOVE_CREATURE, event);
            case UNDO_REMOVE_BUTTON -> publish(EncounterStatePublishedEvent.Action.UNDO_REMOVE, event);
            case OPEN_CREATURE_LINK -> presentationModel.requestOpenCreature(event.creatureId());
            case START_INITIATIVE_BUTTON -> publish(EncounterStatePublishedEvent.Action.OPEN_INITIATIVE, event);
            case INITIATIVE_BACK_BUTTON -> publish(EncounterStatePublishedEvent.Action.BACK_TO_BUILDER, event);
            case INITIATIVE_CONFIRM_BUTTON -> publish(EncounterStatePublishedEvent.Action.CONFIRM_INITIATIVE, event);
            case NEXT_TURN_BUTTON -> publish(EncounterStatePublishedEvent.Action.ADVANCE_TURN, event);
            case HIT_POINT_ADJUSTMENT -> publish(EncounterStatePublishedEvent.Action.MUTATE_HP, event);
            case INITIATIVE_VALUE_SUBMIT -> publish(EncounterStatePublishedEvent.Action.SET_INITIATIVE, event);
            case ADD_PARTY_MEMBER_SELECTION -> publish(EncounterStatePublishedEvent.Action.ADD_PARTY_MEMBER_TO_COMBAT, event);
            case END_COMBAT_CONFIRM_BUTTON -> publish(EncounterStatePublishedEvent.Action.END_COMBAT, event);
            case AWARD_XP_BUTTON -> publish(EncounterStatePublishedEvent.Action.AWARD_XP, event);
            case RETURN_TO_BUILDER_BUTTON -> publish(EncounterStatePublishedEvent.Action.RETURN_TO_BUILDER_AFTER_RESULTS, event);
        }
    }

    private void publish(EncounterStatePublishedEvent.Action action, EncounterStateViewInputEvent event) {
        publish(action, event, event.amount());
    }

    private void publish(EncounterStatePublishedEvent.Action action, EncounterStateViewInputEvent event, int delta) {
        publishedEventListener.accept(new EncounterStatePublishedEvent(
                action,
                event.creatureId(),
                event.selectedPlanId(),
                delta,
                event.undoToken(),
                event.initiatives().stream()
                        .map(entry -> new EncounterStatePublishedEvent.InitiativeEntry(entry.id(), entry.initiative()))
                        .toList(),
                event.combatantId(),
                event.initiativeValue(),
                event.partyMemberId(),
                event.amount(),
                event.healing()));
    }
}
