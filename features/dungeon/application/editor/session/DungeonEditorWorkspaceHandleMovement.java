package features.dungeon.application.editor.session;

import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.application.editor.interaction.DungeonEditorHandleMovement;
import features.dungeon.application.editor.interaction.DungeonEditorHandleMovementKind;

public final class DungeonEditorWorkspaceHandleMovement {
    private DungeonEditorWorkspaceHandleMovement() {
    }

    public static DungeonEditorHandleMovement from(DungeonEditorWorkspaceValues.HandleRef handleRef) {
        return new DungeonEditorHandleMovement(
                DungeonEditorHandleMovementKind.fromName(handleRef.kind().name()),
                handleRef.topologyRef(),
                handleRef.ownerId(),
                handleRef.clusterId(),
                handleRef.corridorId(),
                handleRef.roomId(),
                handleRef.index(),
                DungeonEditorWorkspaceCoreGeometry.cell(handleRef.cell()),
                Direction.parse(handleRef.direction()),
                handleRef.sourceEdge() == null
                        ? null
                        : DungeonEditorWorkspaceCoreGeometry.edge(handleRef.sourceEdge()));
    }
}
