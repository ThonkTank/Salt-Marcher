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
        if (event.importRequested()) {
            publishedEventListener.accept(SessionPlannerPublishedEvent.importPlan(event.selectedPlanId()));
        }
    }

    void consume(SessionPlannerTimelineMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.removeEncounterRequested()) {
            publishedEventListener.accept(SessionPlannerPublishedEvent.removeEncounter(event.encounterToken()));
            return;
        }
        if (event.encounterMoveDelta() < 0) {
            publishedEventListener.accept(SessionPlannerPublishedEvent.moveEncounterUp(event.encounterToken()));
            return;
        }
        if (event.encounterMoveDelta() > 0) {
            publishedEventListener.accept(SessionPlannerPublishedEvent.moveEncounterDown(event.encounterToken()));
            return;
        }
        if (event.shortRestRequested()) {
            publishedEventListener.accept(
                    SessionPlannerPublishedEvent.setRestGap(
                            event.gapIndex(),
                            SessionPlannerPublishedEvent.RestSelection.SHORT_REST));
            return;
        }
        if (event.longRestRequested()) {
            publishedEventListener.accept(
                    SessionPlannerPublishedEvent.setRestGap(
                            event.gapIndex(),
                            SessionPlannerPublishedEvent.RestSelection.LONG_REST));
            return;
        }
        if (event.clearRestRequested()) {
            publishedEventListener.accept(SessionPlannerPublishedEvent.clearRestGap(event.gapIndex()));
        }
    }

    void consume(SessionPlannerLootMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.removedLootToken() > 0L) {
            publishedEventListener.accept(
                    SessionPlannerPublishedEvent.removeLootPlaceholder(event.removedLootToken()));
            return;
        }
        publishedEventListener.accept(
                SessionPlannerPublishedEvent.addLootPlaceholder());
    }
}
