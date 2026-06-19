package src.domain.hex.model.map;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

public final class HexEditorWorkspace {

    private final AtomicReference<HexEditorState> currentState =
            new AtomicReference<>(HexEditorState.empty("No Hex map loaded."));

    public HexEditorState state() {
        return currentState.get();
    }

    public HexEditorState replace(HexEditorState state) {
        HexEditorState nextState = Objects.requireNonNull(state, "state");
        currentState.set(nextState);
        return nextState;
    }
}
