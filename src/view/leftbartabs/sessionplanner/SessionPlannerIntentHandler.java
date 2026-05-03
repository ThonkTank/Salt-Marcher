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
        switch (event.source()) {
            case REFRESH_BUTTON -> publishedEventListener.accept(SessionPlannerPublishedEvent.refresh());
            case IMPORT_BUTTON -> publishedEventListener.accept(SessionPlannerPublishedEvent.importPlan(event.selectedPlanId()));
        }
    }

    void consume(SessionPlannerTimelineMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.source()) {
            case REMOVE_ENCOUNTER_BUTTON -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.removeEncounter(event.encounterToken()));
            case MOVE_ENCOUNTER_UP_BUTTON -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.moveEncounterUp(event.encounterToken()));
            case MOVE_ENCOUNTER_DOWN_BUTTON -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.moveEncounterDown(event.encounterToken()));
            case SHORT_REST_BUTTON -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.setRestGap(
                            event.gapIndex(),
                            SessionPlannerPublishedEvent.RestSelection.SHORT_REST));
            case LONG_REST_BUTTON -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.setRestGap(
                            event.gapIndex(),
                            SessionPlannerPublishedEvent.RestSelection.LONG_REST));
            case CLEAR_REST_BUTTON -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.clearRestGap(event.gapIndex()));
        }
    }

    void consume(SessionPlannerLootMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.source()) {
            case ADD_LOOT_BUTTON -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.addLootPlaceholder());
            case REMOVE_LOOT_BUTTON -> publishedEventListener.accept(
                    SessionPlannerPublishedEvent.removeLootPlaceholder(event.lootToken()));
        }
    }
}
