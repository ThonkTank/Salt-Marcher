package features.dungeon.application.editor.session;

import features.dungeon.application.editor.interaction.DungeonEditorHandleMovement;

public final class DungeonEditorWorkspaceHandleMovement {
    private DungeonEditorWorkspaceHandleMovement() {
    }

    public static DungeonEditorHandleMovement from(DungeonEditorWorkspaceValues.HandleRef handleRef) {
        return new DungeonEditorHandleMovement(
                handleRef.kind(),
                handleRef.topologyRef(),
                handleRef.ownerId(),
                handleRef.clusterId(),
                handleRef.corridorId(),
                handleRef.roomId(),
                handleRef.index(),
                handleRef.cell(),
                handleRef.direction(),
                handleRef.sourceEdge() == null
                        ? null
                        : handleRef.sourceEdge());
    }
}
