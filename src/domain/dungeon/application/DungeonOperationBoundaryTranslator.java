package src.domain.dungeon.application;

import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonInspectorSnapshot;

public final class DungeonOperationBoundaryTranslator {

    private DungeonOperationBoundaryTranslator() {
    }

    public static ApplyDungeonEditorOperationUseCase.OperationInput operationInput(
            @Nullable DungeonEditorOperation operation
    ) {
        return movementInput(operation)
                .or(() -> roomShapeInput(operation))
                .or(() -> corridorInput(operation))
                .or(() -> narrationInput(operation))
                .orElseGet(ApplyDungeonEditorOperationUseCase.OperationInput.NoChange::new);
    }

    private static Optional<ApplyDungeonEditorOperationUseCase.OperationInput> movementInput(
            @Nullable DungeonEditorOperation operation
    ) {
        if (operation instanceof DungeonEditorOperation.MoveTopologyElement moveTopologyElement) {
            return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.MoveTopologyElement(
                    DungeonTopologyBoundaryTranslator.domainTopologyRef(moveTopologyElement.ref()),
                    moveTopologyElement.deltaQ(),
                    moveTopologyElement.deltaR(),
                    moveTopologyElement.deltaLevel()));
        }
        if (operation instanceof DungeonEditorOperation.MoveEditorHandle moveEditorHandle) {
            return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.MoveEditorHandle(
                    DungeonEditorHandleBoundaryTranslator.domainHandle(moveEditorHandle.ref()),
                    moveEditorHandle.deltaQ(),
                    moveEditorHandle.deltaR(),
                    moveEditorHandle.deltaLevel()));
        }
        if (operation instanceof DungeonEditorOperation.MoveBoundaryStretch moveBoundaryStretch) {
            return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.MoveBoundaryStretch(
                    moveBoundaryStretch.clusterId(),
                    moveBoundaryStretch.sourceEdges().stream().map(DungeonCellEdgeBoundaryTranslator::domainEdge).toList(),
                    moveBoundaryStretch.deltaQ(),
                    moveBoundaryStretch.deltaR(),
                    moveBoundaryStretch.deltaLevel()));
        }
        if (operation instanceof DungeonEditorOperation.MoveRoomAnchor moveRoomAnchor) {
            return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.MoveRoomAnchor(
                    moveRoomAnchor.deltaQ(),
                    moveRoomAnchor.deltaR()));
        }
        return Optional.empty();
    }

    private static Optional<ApplyDungeonEditorOperationUseCase.OperationInput> roomShapeInput(
            @Nullable DungeonEditorOperation operation
    ) {
        if (operation instanceof DungeonEditorOperation.PaintRoomRectangle paintRoomRectangle) {
            return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.PaintRoomRectangle(
                    DungeonCellEdgeBoundaryTranslator.domainCell(paintRoomRectangle.start()),
                    DungeonCellEdgeBoundaryTranslator.domainCell(paintRoomRectangle.end())));
        }
        if (operation instanceof DungeonEditorOperation.DeleteRoomRectangle deleteRoomRectangle) {
            return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.DeleteRoomRectangle(
                    DungeonCellEdgeBoundaryTranslator.domainCell(deleteRoomRectangle.start()),
                    DungeonCellEdgeBoundaryTranslator.domainCell(deleteRoomRectangle.end())));
        }
        if (operation instanceof DungeonEditorOperation.EditClusterBoundaries editClusterBoundaries) {
            return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.EditClusterBoundaries(
                    editClusterBoundaries.clusterId(),
                    editClusterBoundaries.edges().stream().map(DungeonCellEdgeBoundaryTranslator::domainEdge).toList(),
                    DungeonTopologyBoundaryTranslator.domainBoundaryKind(editClusterBoundaries.kind()),
                    editClusterBoundaries.deleteBoundary()));
        }
        return Optional.empty();
    }

    private static Optional<ApplyDungeonEditorOperationUseCase.OperationInput> corridorInput(
            @Nullable DungeonEditorOperation operation
    ) {
        if (operation instanceof DungeonEditorOperation.CreateCorridor createCorridor) {
            return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.CreateCorridor(
                    corridorEndpoint(createCorridor.start()),
                    corridorEndpoint(createCorridor.end())));
        }
        if (operation instanceof DungeonEditorOperation.ExtendCorridor extendCorridor) {
            return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.ExtendCorridor(
                    extendCorridor.corridorId(),
                    corridorRoomEndpoint(extendCorridor.endpoint())));
        }
        if (operation instanceof DungeonEditorOperation.MergeCorridors mergeCorridors) {
            return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.MergeCorridors(
                    mergeCorridors.corridorId(),
                    mergeCorridors.mergedCorridorId()));
        }
        if (operation instanceof DungeonEditorOperation.DeleteCorridor deleteCorridor) {
            return Optional.of(
                    new ApplyDungeonEditorOperationUseCase.OperationInput.DeleteCorridor(deleteCorridor.corridorId()));
        }
        return Optional.empty();
    }

    private static Optional<ApplyDungeonEditorOperationUseCase.OperationInput> narrationInput(
            @Nullable DungeonEditorOperation operation
    ) {
        if (operation instanceof DungeonEditorOperation.SaveRoomNarration saveRoomNarration) {
            return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.SaveRoomNarration(
                    saveRoomNarration.roomId(),
                    saveRoomNarration.visualDescription(),
                    saveRoomNarration.exits().stream().map(DungeonOperationBoundaryTranslator::domainExitNarration).toList()));
        }
        return Optional.empty();
    }

    private static ApplyDungeonEditorOperationUseCase.OperationInput.CorridorEndpoint corridorEndpoint(
            DungeonEditorOperation.CorridorEndpoint endpoint
    ) {
        if (endpoint instanceof DungeonEditorOperation.CorridorDoorEndpoint doorEndpoint) {
            return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorDoorEndpoint(
                    doorEndpoint.roomId(),
                    doorEndpoint.clusterId(),
                    DungeonCellEdgeBoundaryTranslator.domainCell(doorEndpoint.roomCell()),
                    DungeonCellEdgeBoundaryTranslator.direction(doorEndpoint.direction()),
                    DungeonTopologyBoundaryTranslator.domainTopologyRef(doorEndpoint.topologyRef()));
        }
        if (endpoint instanceof DungeonEditorOperation.CorridorAnchorEndpoint anchorEndpoint) {
            return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorAnchorEndpoint(
                    anchorEndpoint.hostCorridorId(),
                    DungeonCellEdgeBoundaryTranslator.domainCell(anchorEndpoint.anchorCell()),
                    DungeonTopologyBoundaryTranslator.domainTopologyRef(anchorEndpoint.topologyRef()));
        }
        return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorDoorEndpoint(
                0L,
                0L,
                DungeonCellEdgeBoundaryTranslator.emptyCell(),
                DungeonEdgeDirection.NORTH,
                DungeonTopologyRef.empty());
    }

    private static ApplyDungeonEditorOperationUseCase.OperationInput.CorridorRoomEndpoint corridorRoomEndpoint(
            DungeonEditorOperation.@Nullable CorridorRoomEndpoint endpoint
    ) {
        if (endpoint == null) {
            return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorRoomEndpoint(
                    0L,
                    0L,
                    false,
                    DungeonCellEdgeBoundaryTranslator.emptyCell(),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        }
        return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorRoomEndpoint(
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
