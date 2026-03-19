package features.world.quarantine.dungeonmap.editor.quarantine.state;

import features.world.quarantine.dungeonmap.editor.quarantine.loading.DungeonEditorSessionWorkflow;
import features.world.quarantine.dungeonmap.editor.session.EditorWorkspacePort;
import features.world.quarantine.dungeonmap.editor.session.tool.DungeonToolModeState;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.inspector.DungeonInspectorPort;

import java.util.function.Consumer;

/**
 * Legacy coordinator factory kept in quarantine while the active editor path uses
 * capability-based loading and state wiring instead.
 */
public final class DungeonEditorSessionFactory {

    private DungeonEditorSessionFactory() {
    }

    public static DungeonEditorSessionCoordinator create(
            DungeonEditorSessionWorkflow sessionWorkflow,
            DungeonToolModeState toolModeState,
            Consumer<DungeonEditorTool> displayedToolUpdater,
            EditorWorkspacePort workspace,
            DungeonInspectorPort inspectorPort
    ) {
        throw new UnsupportedOperationException("Legacy session factory is quarantined");
    }
}
