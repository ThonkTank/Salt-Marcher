package features.scene.application;

import features.scene.api.SceneModel;
import features.scene.api.SceneSnapshot;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;

final class ScenePublishedState {

    private final PublishedState<SceneSnapshot> state;
    private final SceneModel model;

    ScenePublishedState(UiDispatcher dispatcher) {
        state = new PublishedState<>(SceneSnapshot.uninitialized(), dispatcher);
        model = new SceneModel(state::current, state::subscribe);
    }

    SceneModel model() {
        return model;
    }

    void publish(SceneSnapshot snapshot) {
        state.publish(snapshot);
    }
}
