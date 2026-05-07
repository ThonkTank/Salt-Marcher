package src.view.leftbartabs.sessionplanner;

import java.util.function.Consumer;

final class SessionPlannerIntentHandler {

    private Consumer<SessionPlannerPublishedEvent> publishedEventListener = ignored -> { };

    void onPublishedEventRequested(Consumer<SessionPlannerPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> { } : listener;
    }

    void consume(SessionPlannerViewInputEvent event) {
        SessionPlannerPublishedEvent publishedEvent = SessionPlannerPublishedEventFactory.fromInput(event);
        if (publishedEvent != null) {
            publishedEventListener.accept(publishedEvent);
        }
    }
}
