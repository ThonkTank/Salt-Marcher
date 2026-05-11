package src.domain.dungeoneditor.model.workspace.helper;

import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorWorkspaceOperationBoundaryTranslationHelper {

    private DungeonEditorWorkspaceOperationBoundaryTranslationHelper() {
    }

    public static DungeonEditorOperation.CorridorEndpoint toDomainCorridorEndpoint(
            DungeonEditorWorkspaceValues.CorridorEndpoint endpoint
    ) {
        return switch (endpoint) {
            case DungeonEditorWorkspaceValues.CorridorDoorEndpoint door -> new DungeonEditorOperation.CorridorDoorEndpoint(
                    door.roomId(),
                    door.clusterId(),
                     DungeonEditorWorkspaceCellBoundaryTranslationHelper.toDomainCell(door.roomCell()),
                    door.direction(),
                    DungeonEditorWorkspaceTopologyBoundaryTranslationHelper.toDomainTopologyRef(door.topologyRef()));
            case DungeonEditorWorkspaceValues.CorridorAnchorEndpoint anchor ->
                    new DungeonEditorOperation.CorridorAnchorEndpoint(
                            anchor.hostCorridorId(),
                             DungeonEditorWorkspaceCellBoundaryTranslationHelper.toDomainCell(anchor.anchorCell()),
                            DungeonEditorWorkspaceTopologyBoundaryTranslationHelper.toDomainTopologyRef(anchor.topologyRef()));
        };
    }
}
