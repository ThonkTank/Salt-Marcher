package src.domain.dungeoneditor.application;

import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

final class DungeonEditorWorkspaceOperationBoundaryTranslator {

    private DungeonEditorWorkspaceOperationBoundaryTranslator() {
    }

    static DungeonEditorOperation.CorridorEndpoint toDomainCorridorEndpoint(
            DungeonEditorWorkspaceValues.CorridorEndpoint endpoint
    ) {
        return switch (endpoint) {
            case DungeonEditorWorkspaceValues.CorridorDoorEndpoint door -> new DungeonEditorOperation.CorridorDoorEndpoint(
                    door.roomId(),
                    door.clusterId(),
                    DungeonEditorWorkspaceCellBoundaryTranslator.toDomainCell(door.roomCell()),
                    door.direction(),
                    DungeonEditorWorkspaceTopologyBoundaryTranslator.toDomainTopologyRef(door.topologyRef()));
            case DungeonEditorWorkspaceValues.CorridorAnchorEndpoint anchor ->
                    new DungeonEditorOperation.CorridorAnchorEndpoint(
                            anchor.hostCorridorId(),
                            DungeonEditorWorkspaceCellBoundaryTranslator.toDomainCell(anchor.anchorCell()),
                            DungeonEditorWorkspaceTopologyBoundaryTranslator.toDomainTopologyRef(anchor.topologyRef()));
        };
    }
}
