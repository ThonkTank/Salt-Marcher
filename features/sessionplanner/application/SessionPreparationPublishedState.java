package features.sessionplanner.application;

import features.sessionplanner.api.SessionPreparationModel;
import features.sessionplanner.api.SessionPreparationSnapshot;
import java.util.Objects;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;

public final class SessionPreparationPublishedState {

    private final PublishedState<SessionPreparationSnapshot> state;
    private final SessionPreparationModel model;

    public SessionPreparationPublishedState(UiDispatcher dispatcher) {
        state = new PublishedState<>(
                SessionPreparationSnapshot.idle(),
                Objects.requireNonNull(dispatcher, "dispatcher"));
        model = new SessionPreparationModel(state::current, state::subscribe);
    }

    public SessionPreparationModel model() {
        return model;
    }

    SessionPreparationSnapshot current() {
        return state.current();
    }

    void publish(SessionPreparationSnapshot snapshot) {
        state.publish(Objects.requireNonNull(snapshot, "snapshot"));
    }
}
