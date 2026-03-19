package features.world.quarantine.dungeonmap.editor.quarantine.state;

import features.world.quarantine.dungeonmap.editor.session.DungeonEditorSessionState;

import java.util.Objects;

/**
 * Encapsulates transient state clearing so that it can be constructed before
 * {@link features.world.quarantine.dungeonmap.editor.session.tool.DungeonEditorToolSessionController}
 * exists. Both the edit controller and the tool session controller use this to clear
 * transient state without a circular construction dependency.
 */
public final class DungeonEditorTransientStateManager {

    private final DungeonEditorSessionState sessionState;
    private final DungeonEditorSessionUpdateSink sessionUpdateSink;

    DungeonEditorTransientStateManager(
            DungeonEditorSessionState sessionState,
            DungeonEditorSessionUpdateSink sessionUpdateSink) {
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.sessionUpdateSink = Objects.requireNonNull(sessionUpdateSink, "sessionUpdateSink");
    }

    public void clearTransientState() {
        sessionState.clearTransientState();
        sessionUpdateSink.applySessionUpdate(DungeonEditorSessionUpdate.statePaneChanged());
    }
}
