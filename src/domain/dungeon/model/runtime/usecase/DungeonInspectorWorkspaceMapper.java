package src.domain.dungeon.model.runtime.usecase;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

final class DungeonInspectorWorkspaceMapper {

    private DungeonInspectorWorkspaceMapper() {
    }

    static DungeonEditorWorkspaceValues.@Nullable Inspector inspectorFacts(
            LoadDungeonSnapshotUseCase.@Nullable InspectorSnapshotData inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new DungeonEditorWorkspaceValues.Inspector(
                inspector.title(),
                inspector.description(),
                inspector.facts(),
                statePanelFacts(inspector.statePanelFacts()),
                roomNarrations(inspector.roomNarrations()));
    }

    private static DungeonEditorWorkspaceValues.InspectorStatePanelState statePanelFacts(
            LoadDungeonSnapshotUseCase.StatePanelFacts facts
    ) {
        LoadDungeonSnapshotUseCase.StatePanelFacts safeFacts = facts == null
                ? LoadDungeonSnapshotUseCase.StatePanelFacts.empty()
                : facts;
        return new DungeonEditorWorkspaceValues.InspectorStatePanelState(
                stairGeometryFacts(safeFacts.stairGeometry()),
                transitionDestinationFacts(safeFacts.transitionDestination()));
    }

    private static DungeonEditorWorkspaceValues.InspectorStairGeometryState stairGeometryFacts(
            LoadDungeonSnapshotUseCase.StairGeometryPanelFacts facts
    ) {
        LoadDungeonSnapshotUseCase.StairGeometryPanelFacts safeFacts = facts == null
                ? LoadDungeonSnapshotUseCase.StairGeometryPanelFacts.empty()
                : facts;
        return new DungeonEditorWorkspaceValues.InspectorStairGeometryState(
                safeFacts.present(),
                safeFacts.stairId(),
                safeFacts.shapeName(),
                safeFacts.directionName(),
                safeFacts.dimension1(),
                safeFacts.dimension2());
    }

    private static DungeonEditorWorkspaceValues.InspectorTransitionDestinationState transitionDestinationFacts(
            LoadDungeonSnapshotUseCase.TransitionDestinationPanelFacts facts
    ) {
        LoadDungeonSnapshotUseCase.TransitionDestinationPanelFacts safeFacts = facts == null
                ? LoadDungeonSnapshotUseCase.TransitionDestinationPanelFacts.empty()
                : facts;
        return new DungeonEditorWorkspaceValues.InspectorTransitionDestinationState(
                safeFacts.present(),
                safeFacts.destinationTypeKey(),
                safeFacts.mapId(),
                safeFacts.tileId(),
                safeFacts.transitionId());
    }

    private static List<DungeonEditorWorkspaceValues.RoomNarrationCard> roomNarrations(
            List<LoadDungeonSnapshotUseCase.RoomNarrationData> roomNarrations
    ) {
        List<DungeonEditorWorkspaceValues.RoomNarrationCard> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration : roomNarrations) {
            result.add(roomNarration(roomNarration));
        }
        return List.copyOf(result);
    }

    private static DungeonEditorWorkspaceValues.RoomNarrationCard roomNarration(
            LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration
    ) {
        return new DungeonEditorWorkspaceValues.RoomNarrationCard(
                roomNarration.roomId(),
                roomNarration.roomName(),
                roomNarration.visualDescription(),
                roomExits(roomNarration.exits()));
    }

    private static List<DungeonEditorWorkspaceValues.RoomExitNarration> roomExits(
            List<LoadDungeonSnapshotUseCase.RoomExitNarrationData> exits
    ) {
        List<DungeonEditorWorkspaceValues.RoomExitNarration> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomExitNarrationData exit : exits) {
            Cell cell = exit.cell();
            result.add(new DungeonEditorWorkspaceValues.RoomExitNarration(
                    exit.label(),
                    cell == null
                            ? DungeonEditorWorkspaceValues.Cell.empty()
                            : new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level()),
                    exit.direction().name(),
                    exit.description()));
        }
        return List.copyOf(result);
    }
}
