package features.world.quarantine.dungeonmap.editor.session;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonWallPathSessionState;

/**
 * Narrow workspace interface used by session controllers.
 * Decouples session logic from the concrete {@code DungeonEditorSplitWorkspace} UI type.
 */
public interface EditorWorkspacePort {

    DungeonWallPathSessionState wallPathState();

    void setSelectedCorridorDoorHandle(CorridorDoorHandle handle);

    void setEditorTool(DungeonEditorTool editorTool);

    void setViewMode(DungeonViewMode viewMode, DungeonEditorTool editorTool);
}
