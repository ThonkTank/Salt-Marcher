package features.hex.domain.map;

import java.util.Objects;

public final class HexEditorWorkspace {

    private HexEditorState currentState = HexEditorState.empty("No Hex map loaded.");

    public HexEditorState state() {
        return currentState;
    }

    public HexEditorState replace(HexEditorState state) {
        HexEditorState nextState = Objects.requireNonNull(state, "state");
        currentState = nextState;
        return nextState;
    }
}
