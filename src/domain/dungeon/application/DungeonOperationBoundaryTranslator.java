package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonCorridorAnchorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorDoorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonInspectorSnapshot;

public final class DungeonOperationBoundaryTranslator {

    private DungeonOperationBoundaryTranslator() {
    }

    public static ApplyDungeonEditorOperationUseCase.OperationMutation operationMutation(
            @Nullable DungeonEditorOperation operation
    ) {
        return switch (operation) {
            case null -> ApplyDungeonEditorOperationUseCase.OperationMutation.identity();
            case DungeonEditorOperation.MoveTopologyElement moveTopologyElement -> {
                var ref = DungeonTopologyBoundaryTranslator.domainTopologyRef(moveTopologyElement.ref());
                yield current -> current.moveTopologyElement(
                        ref,
                        moveTopologyElement.deltaQ(),
                        moveTopologyElement.deltaR(),
                        moveTopologyElement.deltaLevel());
            }
            case DungeonEditorOperation.MoveEditorHandle moveEditorHandle -> {
                var handle = DungeonEditorHandleBoundaryTranslator.domainHandle(moveEditorHandle.ref());
                yield current -> current.moveEditorHandle(
                        handle,
                        moveEditorHandle.deltaQ(),
                        moveEditorHandle.deltaR(),
                        moveEditorHandle.deltaLevel());
            }
            case DungeonEditorOperation.MoveBoundaryStretch moveBoundaryStretch -> {
                var sourceEdges = moveBoundaryStretch.sourceEdges()
                        .stream()
                        .map(DungeonCellEdgeBoundaryTranslator::domainEdge)
                        .toList();
                yield current -> current.moveBoundaryStretch(
                        moveBoundaryStretch.clusterId(),
                        sourceEdges,
                        moveBoundaryStretch.deltaQ(),
                        moveBoundaryStretch.deltaR(),
                        moveBoundaryStretch.deltaLevel());
            }
            case DungeonEditorOperation.MoveRoomAnchor moveRoomAnchor ->
                    current -> current.moveRoomAnchor(moveRoomAnchor.deltaQ(), moveRoomAnchor.deltaR());
            case DungeonEditorOperation.PaintRoomRectangle paintRoomRectangle -> {
                DungeonCell start = DungeonCellEdgeBoundaryTranslator.domainCell(paintRoomRectangle.start());
                DungeonCell end = DungeonCellEdgeBoundaryTranslator.domainCell(paintRoomRectangle.end());
                yield current -> current.paintRoomRectangle(start, end);
            }
            case DungeonEditorOperation.DeleteRoomRectangle deleteRoomRectangle -> {
                DungeonCell start = DungeonCellEdgeBoundaryTranslator.domainCell(deleteRoomRectangle.start());
                DungeonCell end = DungeonCellEdgeBoundaryTranslator.domainCell(deleteRoomRectangle.end());
                yield current -> current.deleteRoomRectangle(start, end);
            }
            case DungeonEditorOperation.EditClusterBoundaries editClusterBoundaries -> {
                var edges = editClusterBoundaries.edges().stream().map(DungeonCellEdgeBoundaryTranslator::domainEdge).toList();
                DungeonClusterBoundaryKind kind =
                        DungeonTopologyBoundaryTranslator.domainBoundaryKind(editClusterBoundaries.kind());
                yield current -> current.editClusterBoundaries(
                        editClusterBoundaries.clusterId(),
                        edges,
                        kind,
                        editClusterBoundaries.deleteBoundary());
            }
            case DungeonEditorOperation.CreateCorridor createCorridor -> {
                DungeonCorridorEndpoint start = corridorEndpoint(createCorridor.start());
                DungeonCorridorEndpoint end = corridorEndpoint(createCorridor.end());
                yield current -> current.createCorridor(start, end);
            }
            case DungeonEditorOperation.ExtendCorridor extendCorridor -> {
                DungeonCorridorRoomEndpoint endpoint = corridorRoomEndpoint(extendCorridor.endpoint());
                yield current -> current.extendCorridor(extendCorridor.corridorId(), endpoint);
            }
            case DungeonEditorOperation.MergeCorridors mergeCorridors ->
                    current -> current.mergeCorridors(mergeCorridors.corridorId(), mergeCorridors.mergedCorridorId());
            case DungeonEditorOperation.DeleteCorridor deleteCorridor ->
                    current -> current.deleteCorridor(deleteCorridor.corridorId());
            case DungeonEditorOperation.SaveRoomNarration saveRoomNarration -> {
                var exits = saveRoomNarration.exits().stream()
                        .map(DungeonOperationBoundaryTranslator::domainExitNarration)
                        .toList();
                DungeonRoomNarration narration = new DungeonRoomNarration(saveRoomNarration.visualDescription(), exits);
                yield current -> current.saveRoomNarration(saveRoomNarration.roomId(), narration);
            }
        };
    }

    private static DungeonCorridorEndpoint corridorEndpoint(
            DungeonEditorOperation.CorridorEndpoint endpoint
    ) {
        return switch (endpoint) {
            case DungeonEditorOperation.CorridorDoorEndpoint doorEndpoint -> new DungeonCorridorDoorEndpoint(
                    doorEndpoint.roomId(),
                    doorEndpoint.clusterId(),
                    DungeonCellEdgeBoundaryTranslator.domainCell(doorEndpoint.roomCell()),
                    DungeonCellEdgeBoundaryTranslator.direction(doorEndpoint.direction()),
                    DungeonTopologyBoundaryTranslator.domainTopologyRef(doorEndpoint.topologyRef()));
            case DungeonEditorOperation.CorridorAnchorEndpoint anchorEndpoint -> new DungeonCorridorAnchorEndpoint(
                    anchorEndpoint.hostCorridorId(),
                    DungeonCellEdgeBoundaryTranslator.domainCell(anchorEndpoint.anchorCell()),
                    DungeonTopologyBoundaryTranslator.domainTopologyRef(anchorEndpoint.topologyRef()));
            case null -> new DungeonCorridorDoorEndpoint(
                    0L,
                    0L,
                    DungeonCellEdgeBoundaryTranslator.emptyCell(),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        };
    }

    private static DungeonCorridorRoomEndpoint corridorRoomEndpoint(
            DungeonEditorOperation.@Nullable CorridorRoomEndpoint endpoint
    ) {
        if (endpoint == null) {
            return new DungeonCorridorRoomEndpoint(
                    0L,
                    0L,
                    false,
                    DungeonCellEdgeBoundaryTranslator.emptyCell(),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        }
        return new DungeonCorridorRoomEndpoint(
                endpoint.roomId(),
                endpoint.clusterId(),
                endpoint.fixedDoor(),
                DungeonCellEdgeBoundaryTranslator.domainCell(endpoint.roomCell()),
                DungeonCellEdgeBoundaryTranslator.direction(endpoint.direction()),
                DungeonTopologyBoundaryTranslator.domainTopologyRef(endpoint.topologyRef()));
    }

    private static DungeonRoomExitDescription domainExitNarration(
            DungeonInspectorSnapshot.RoomExitNarration exitNarration
    ) {
        return new DungeonRoomExitDescription(
                DungeonCellEdgeBoundaryTranslator.domainCell(exitNarration.cell()),
                src.domain.dungeon.map.value.DungeonEdgeDirection.parse(exitNarration.direction()),
                exitNarration.description());
    }
}
