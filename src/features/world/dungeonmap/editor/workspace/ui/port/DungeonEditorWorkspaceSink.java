package features.world.dungeonmap.editor.workspace.ui.port;

import features.world.dungeonmap.editor.edit.application.DungeonEditorEditCommand;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneSelectionSink;
import features.world.dungeonmap.editor.workspace.ui.wallpath.DungeonWallPathCommit;

public interface DungeonEditorWorkspaceSink extends DungeonPaneSelectionSink {

    DungeonEditorWorkspaceSink NO_OP = new DungeonEditorWorkspaceSink() {};

    default void onEditRequested(DungeonEditorEditCommand command) {}

    default void onWallPathStateChanged() {}

    default void onWallPathCommitRequested(DungeonWallPathCommit request, boolean deleteMode) {}
}
