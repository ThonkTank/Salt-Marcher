package features.world.quarantine.dungeonmap.editor.workspace.contract;

import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorEditCommand;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonWallPathCommit;

public interface DungeonEditorWorkspaceSink extends DungeonPaneInteractionSink {

    DungeonEditorWorkspaceSink NO_OP = new NoOp();

    final class NoOp extends DungeonPaneInteractionSinkAdapter implements DungeonEditorWorkspaceSink {}

    default void onEditRequested(DungeonEditorEditCommand command) {}

    default void onWallPathStateChanged() {}

    default void onWallPathCommitRequested(DungeonWallPathCommit request, boolean deleteMode) {}
}
