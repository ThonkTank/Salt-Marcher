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
        switch (event.kind()) {
            case GENERATE -> publish(EncounterStatePublishedEvent.Action.GENERATE, event);
            case PREVIOUS_ALTERNATIVE -> publish(EncounterStatePublishedEvent.Action.SHIFT_ALTERNATIVE, event, -1);
            case NEXT_ALTERNATIVE -> publish(EncounterStatePublishedEvent.Action.SHIFT_ALTERNATIVE, event, 1);
            case SAVE_ENCOUNTER -> publish(EncounterStatePublishedEvent.Action.SAVE_CURRENT_PLAN, event);
            case OPEN_SAVED_ENCOUNTER -> publish(EncounterStatePublishedEvent.Action.OPEN_SAVED_PLAN, event);
            case CLEAR_GENERATION_HISTORY -> publish(EncounterStatePublishedEvent.Action.CLEAR_GENERATION_HISTORY, event);
            case ROSTER_INCREMENT -> publish(EncounterStatePublishedEvent.Action.INCREMENT_CREATURE, event);
            case ROSTER_DECREMENT -> publish(EncounterStatePublishedEvent.Action.DECREMENT_CREATURE, event);
            case ROSTER_REMOVE -> publish(EncounterStatePublishedEvent.Action.REMOVE_CREATURE, event);
            case UNDO_REMOVE -> publish(EncounterStatePublishedEvent.Action.UNDO_REMOVE, event);
            case OPEN_CREATURE -> presentationModel.requestOpenCreature(event.creatureId());
            case START_INITIATIVE -> publish(EncounterStatePublishedEvent.Action.OPEN_INITIATIVE, event);
            case INITIATIVE_BACK -> publish(EncounterStatePublishedEvent.Action.BACK_TO_BUILDER, event);
            case INITIATIVE_CONFIRM -> publish(EncounterStatePublishedEvent.Action.CONFIRM_INITIATIVE, event);
            case NEXT_TURN -> publish(EncounterStatePublishedEvent.Action.ADVANCE_TURN, event);
            case DAMAGE -> publish(EncounterStatePublishedEvent.Action.MUTATE_HP, event);
            case HEAL -> publish(EncounterStatePublishedEvent.Action.MUTATE_HP, event);
            case SET_INITIATIVE -> publish(EncounterStatePublishedEvent.Action.SET_INITIATIVE, event);
            case ADD_PARTY_MEMBER_TO_COMBAT -> publish(EncounterStatePublishedEvent.Action.ADD_PARTY_MEMBER_TO_COMBAT, event);
            case END_COMBAT -> publish(EncounterStatePublishedEvent.Action.END_COMBAT, event);
            case AWARD_XP -> publish(EncounterStatePublishedEvent.Action.AWARD_XP, event);
            case RETURN_TO_BUILDER -> publish(EncounterStatePublishedEvent.Action.RETURN_TO_BUILDER_AFTER_RESULTS, event);
        }
    }

    private void publish(EncounterStatePublishedEvent.Action action, EncounterStateViewInputEvent event) {
        publish(action, event, event == null ? 0 : event.value());
    }

    private void publish(EncounterStatePublishedEvent.Action action, EncounterStateViewInputEvent event, int delta) {
        EncounterStateViewInputEvent safeEvent = event == null
                ? EncounterStateViewInputEvent.generate()
                : event;
        publishedEventListener.accept(new EncounterStatePublishedEvent(
                action,
                safeEvent.creatureId(),
                safeEvent.planId(),
                delta,
                safeEvent.undoToken(),
                safeEvent.initiatives().stream()
                        .map(entry -> new EncounterStatePublishedEvent.InitiativeEntry(entry.id(), entry.initiative()))
                        .toList(),
                safeEvent.combatantId(),
                safeEvent.value(),
                safeEvent.partyMemberId(),
                safeEvent.value(),
                safeEvent.healing()));
    }
}
