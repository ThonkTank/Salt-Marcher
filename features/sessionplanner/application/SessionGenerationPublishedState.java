package features.sessionplanner.application;

import java.util.Objects;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;
import features.sessionplanner.api.SessionGenerationPreviewModel;
import features.sessionplanner.api.SessionGenerationPreviewSnapshot;
import features.sessionplanner.api.SessionGenerationPreviewStatus;

public final class SessionGenerationPublishedState {

    private final PublishedState<SessionGenerationPreviewSnapshot> state;
    private final SessionGenerationPreviewModel model;

    public SessionGenerationPublishedState(UiDispatcher dispatcher) {
        state = new PublishedState<>(
                SessionGenerationPreviewSnapshot.idle(),
                Objects.requireNonNull(dispatcher, "dispatcher"));
        model = new SessionGenerationPreviewModel(state::current, state::subscribe);
    }

    public SessionGenerationPreviewModel model() {
        return model;
    }

    SessionGenerationPreviewSnapshot current() {
        return state.current();
    }

    void publish(SessionGenerationPreviewSnapshot snapshot) {
        state.publish(Objects.requireNonNull(snapshot, "snapshot"));
    }

    void markStale() {
        SessionGenerationPreviewSnapshot current = state.current();
        if (current.status() == SessionGenerationPreviewStatus.IDLE
                || current.status() == SessionGenerationPreviewStatus.STALE) {
            return;
        }
        state.publish(new SessionGenerationPreviewSnapshot(
                SessionGenerationPreviewStatus.STALE,
                "Eingaben oder Session wurden geändert. Bitte Vorschau neu erzeugen.",
                current.sessionId(),
                current.generationId(),
                current.seed(),
                current.catalogHash(),
                current.summary(),
                current.encounters(),
                current.treasures(),
                current.audits(),
                current.attemptToken(),
                false));
    }
}
