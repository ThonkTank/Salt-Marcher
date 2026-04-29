package src.view.leftbartabs.sessionplanner;

import java.util.function.Consumer;

final class SessionPlannerIntentHandler {

    private Consumer<SessionPlannerPublishedEvent> publishedEventListener = ignored -> { };

    void onPublishedEventRequested(Consumer<SessionPlannerPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> { } : listener;
    }

    void consume(SessionPlannerControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.kind()) {
            case REFRESH -> publishedEventListener.accept(SessionPlannerPublishedEvent.refresh());
            case IMPORT_PLAN -> publishedEventListener.accept(SessionPlannerPublishedEvent.importPlan(event.planId()));
        }
    }

    void consume(SessionPlannerMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.kind()) {
            case REMOVE_ENCOUNTER -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.removeEncounter(event.encounterToken()));
            case MOVE_ENCOUNTER_UP -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.moveEncounterUp(event.encounterToken()));
            case MOVE_ENCOUNTER_DOWN -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.moveEncounterDown(event.encounterToken()));
            case SET_SHORT_REST -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.setRestGap(
                            event.gapIndex(),
                            SessionPlannerPublishedEvent.RestSelection.SHORT_REST));
            case SET_LONG_REST -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.setRestGap(
                            event.gapIndex(),
                            SessionPlannerPublishedEvent.RestSelection.LONG_REST));
            case CLEAR_REST -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.clearRestGap(event.gapIndex()));
            case ADD_LOOT_PLACEHOLDER -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.addLootPlaceholder());
            case REMOVE_LOOT_PLACEHOLDER -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.removeLootPlaceholder(event.lootToken()));
        }
    }
}
