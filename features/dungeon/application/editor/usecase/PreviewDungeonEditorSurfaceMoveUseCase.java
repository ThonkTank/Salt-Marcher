package features.dungeon.application.editor.usecase;

import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonEditorHandleKind;
import features.dungeon.application.editor.session.DungeonEditorDungeonState;
import features.dungeon.application.editor.session.DungeonEditorSessionSnapshot;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceGeometry;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.HandleRef;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.application.editor.helper.PreviewDungeonEditorSurfaceAreaMoveHelper;
import features.dungeon.application.editor.helper.PreviewDungeonEditorSurfaceBoundaryMoveHelper;
import features.dungeon.application.editor.helper.PreviewDungeonEditorSurfaceHandleMoveHelper;
import features.dungeon.application.editor.helper.PreviewDungeonEditorSurfaceCreateHelper;
import features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy;

public final class PreviewDungeonEditorSurfaceMoveUseCase {
    private final PreviewDungeonEditorDoorMoveUseCase doorMovePreviewUseCase =
            new PreviewDungeonEditorDoorMoveUseCase();
    private final PreviewDungeonEditorSurfaceAreaMoveHelper areas = new PreviewDungeonEditorSurfaceAreaMoveHelper();
    private final PreviewDungeonEditorSurfaceBoundaryMoveHelper boundaries =
            new PreviewDungeonEditorSurfaceBoundaryMoveHelper();
    private final PreviewDungeonEditorSurfaceHandleMoveHelper handles = new PreviewDungeonEditorSurfaceHandleMoveHelper();
    private final PreviewDungeonEditorSurfaceCreateHelper creations;

    public PreviewDungeonEditorSurfaceMoveUseCase(CorridorRoutingPolicy corridorRoutingPolicy) {
        creations = new PreviewDungeonEditorSurfaceCreateHelper(corridorRoutingPolicy);
    }

    public DungeonEditorDungeonState.@Nullable PreviewFacts execute(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            DungeonEditorSessionValues.Preview preview
    ) {
        DungeonEditorDungeonState.PreviewFacts doorPreview = doorMovePreviewUseCase.execute(surface, preview);
        if (doorPreview != null || surface == null) {
            return doorPreview;
        }
        MapSnapshot candidate = candidateMap(surface.map(), preview);
        if (candidate == null || candidate.equals(surface.map())) {
            return null;
        }
        return new DungeonEditorDungeonState.PreviewFacts(
                new DungeonEditorDungeonState.SnapshotFacts(
                        surface.mapId(),
                        surface.requestGeneration(),
                        surface.acceptedRevision(),
                        surface.mapName(),
                        surface.revision(),
                        candidate),
                "");
    }

    private @Nullable MapSnapshot candidateMap(MapSnapshot committed, DungeonEditorSessionValues.Preview preview) {
        return switch (preview) {
            case DungeonEditorSessionValues.NoPreview ignored -> null;
            case DungeonEditorSessionValues.RoomRectanglePreview room -> creations.roomRectangle(committed, room);
            case DungeonEditorSessionValues.ClusterBoundariesPreview cluster ->
                    creations.clusterBoundaries(committed, cluster);
            case DungeonEditorSessionValues.MoveHandlePreview move -> moveHandlePreview(committed, move);
            case DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch -> stretchPreview(committed, stretch);
            case DungeonEditorSessionValues.StairCreatePreview stair -> creations.stair(committed, stair);
            case DungeonEditorSessionValues.CorridorCreatePreview corridor -> creations.corridor(committed, corridor);
            case DungeonEditorSessionValues.DeleteCorridorPreview deletion ->
                    creations.deleteCorridor(committed, deletion);
            case null -> null;
        };
    }

    private @Nullable MapSnapshot moveHandlePreview(
            MapSnapshot committed,
            DungeonEditorSessionValues.MoveHandlePreview preview
    ) {
        DungeonEditorHandleKind kind = preview.handleRef().kind();
        if (kind == DungeonEditorHandleKind.CLUSTER_LABEL) {
            return clusterMovePreview(committed, preview);
        }
        if (kind == DungeonEditorHandleKind.CLUSTER_CORNER) {
            return cornerMovePreview(committed, preview);
        }
        if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN) {
            return sourceEdgeMovePreview(committed, preview);
        }
        if (kind == DungeonEditorHandleKind.STAIR_ANCHOR
                || kind == DungeonEditorHandleKind.CORRIDOR_ANCHOR
                || kind == DungeonEditorHandleKind.CORRIDOR_WAYPOINT) {
            return activeHandlePreview(committed, preview);
        }
        return null;
    }

    private MapSnapshot activeHandlePreview(
            MapSnapshot committed,
            DungeonEditorSessionValues.MoveHandlePreview preview
    ) {
        return new MapSnapshot(
                committed.topology(),
                committed.width(),
                committed.height(),
                committed.areas(),
                committed.boundaries(),
                committed.features(),
                handles.movedActiveHandle(
                        committed.editorHandles(),
                        preview.handleRef(),
                        preview.deltaQ(),
                        preview.deltaR(),
                        preview.deltaLevel()));
    }

    private MapSnapshot clusterMovePreview(
            MapSnapshot committed,
            DungeonEditorSessionValues.MoveHandlePreview preview
    ) {
        long clusterId = clusterId(preview.handleRef());
        Set<Cell> clusterCells = areas.clusterCells(committed.areas(), clusterId);
        return new MapSnapshot(
                committed.topology(),
                committed.width(),
                committed.height(),
                areas.movedClusterAreas(
                        committed.areas(),
                        clusterId,
                        preview.deltaQ(),
                        preview.deltaR(),
                        preview.deltaLevel()),
                boundaries.movedClusterBoundaries(
                        committed.boundaries(),
                        clusterCells,
                        preview.deltaQ(),
                        preview.deltaR(),
                        preview.deltaLevel()),
                committed.features(),
                handles.movedClusterHandles(
                        committed.editorHandles(),
                        clusterId,
                        preview.deltaQ(),
                        preview.deltaR(),
                        preview.deltaLevel()));
    }

    private MapSnapshot cornerMovePreview(
            MapSnapshot committed,
            DungeonEditorSessionValues.MoveHandlePreview preview
    ) {
        return new MapSnapshot(
                committed.topology(),
                committed.width(),
                committed.height(),
                areas.movedAffectedAreaCells(
                        committed.areas(),
                        clusterId(preview.handleRef()),
                        DungeonEditorWorkspaceGeometry.adjacentCornerCells(preview.handleRef().cell()),
                        preview.deltaQ(),
                        preview.deltaR(),
                        preview.deltaLevel()),
                boundaries.movedCornerBoundaries(
                        committed.boundaries(),
                        preview.handleRef().cell(),
                        preview.deltaQ(),
                        preview.deltaR(),
                        preview.deltaLevel()),
                committed.features(),
                handles.movedCornerHandles(
                        committed.editorHandles(),
                        preview.handleRef(),
                        preview.handleRef().cell(),
                        preview.deltaQ(),
                        preview.deltaR(),
                        preview.deltaLevel()));
    }

    private @Nullable MapSnapshot stretchPreview(
            MapSnapshot committed,
            DungeonEditorSessionValues.MoveBoundaryStretchPreview preview
    ) {
        return sourceEdgeMovePreview(
                committed,
                preview.clusterId(),
                preview.deltaQ(),
                preview.deltaR(),
                preview.deltaLevel(),
                DungeonEditorWorkspaceGeometry.adjacentFloorCells(preview.sourceEdges()),
                preview.sourceEdges());
    }

    private @Nullable MapSnapshot sourceEdgeMovePreview(
            MapSnapshot committed,
            DungeonEditorSessionValues.MoveHandlePreview preview
    ) {
        List<Edge> sourceEdges = sourceEdges(preview.handleRef().sourceEdge());
        return sourceEdgeMovePreview(
                committed,
                clusterId(preview.handleRef()),
                preview.deltaQ(),
                preview.deltaR(),
                preview.deltaLevel(),
                DungeonEditorWorkspaceGeometry.adjacentFloorCells(sourceEdges),
                sourceEdges);
    }

    private @Nullable MapSnapshot sourceEdgeMovePreview(
            MapSnapshot committed,
            long clusterId,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            Set<Cell> affectedCells,
            List<Edge> sourceEdges
    ) {
        if (sourceEdges.isEmpty() || deltaQ == 0 && deltaR == 0 && deltaLevel == 0) {
            return null;
        }
        return new MapSnapshot(
                committed.topology(),
                committed.width(),
                committed.height(),
                areas.movedAffectedAreaCells(committed.areas(), clusterId, affectedCells, deltaQ, deltaR, deltaLevel),
                boundaries.movedSourceEdgeBoundaries(committed.boundaries(), sourceEdges, deltaQ, deltaR, deltaLevel),
                committed.features(),
                handles.movedSourceEdgeHandles(sourceEdges, committed.editorHandles(), deltaQ, deltaR, deltaLevel));
    }

    private static List<Edge> sourceEdges(@Nullable Edge sourceEdge) {
        return sourceEdge == null ? List.of() : List.of(sourceEdge);
    }

    private static long clusterId(HandleRef handleRef) {
        return handleRef.clusterId() > 0L ? handleRef.clusterId() : handleRef.ownerId();
    }
}
