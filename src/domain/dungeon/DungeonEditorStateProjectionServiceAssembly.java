package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.published.DungeonEditorSurface;

final class DungeonEditorStateProjectionServiceAssembly {

    private DungeonEditorStateProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonEditorStateSnapshot snapshot(
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot.SnapshotData snapshot,
            @Nullable DungeonEditorSurface surface
    ) {
        return new src.domain.dungeon.published.DungeonEditorStateSnapshot(
                selection(snapshot.selection()),
                surface == null ? null : surface.inspector(),
                preview(snapshot.preview()),
                snapshot.statusText(),
                DungeonEditorValueProjectionServiceAssembly.viewMode(snapshot.viewMode()),
                DungeonEditorValueProjectionServiceAssembly.tool(snapshot.selectedTool()),
                DungeonEditorValueProjectionServiceAssembly.overlay(snapshot.overlaySettings()),
                snapshot.projectionLevel());
    }

    static src.domain.dungeon.published.DungeonEditorStateSnapshot.Selection selection(
            DungeonEditorSessionValues.@Nullable Selection selection
    ) {
        DungeonEditorSessionValues.Selection safeSelection = selection == null
                ? DungeonEditorSessionValues.Selection.empty()
                : selection;
        return new src.domain.dungeon.published.DungeonEditorStateSnapshot.Selection(
                DungeonEditorValueProjectionServiceAssembly.topologyRef(safeSelection.topologyRef()),
                safeSelection.clusterId(),
                safeSelection.clusterSelection(),
                safeSelection.handleRef().equals(DungeonEditorSessionValues.emptyHandleRef())
                        ? null
                        : DungeonEditorValueProjectionServiceAssembly.handleRef(safeSelection.handleRef()));
    }

    static src.domain.dungeon.published.DungeonEditorPreview preview(DungeonEditorSessionValues.@Nullable Preview preview) {
        if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
            return src.domain.dungeon.published.DungeonEditorPreview.none();
        }
        return switch (preview) {
            case DungeonEditorSessionValues.RoomRectanglePreview room ->
                    new src.domain.dungeon.published.DungeonEditorPreview.RoomRectanglePreview(
                            DungeonEditorValueProjectionServiceAssembly.cell(room.start()),
                            DungeonEditorValueProjectionServiceAssembly.cell(room.end()),
                            room.deleteMode());
            case DungeonEditorSessionValues.ClusterBoundariesPreview boundaries ->
                    new src.domain.dungeon.published.DungeonEditorPreview.ClusterBoundariesPreview(
                            boundaries.clusterId(),
                            edges(boundaries.edges()),
                            boundaries.boundaryKind().name(),
                            boundaries.deleteMode());
            case DungeonEditorSessionValues.StairCreatePreview stair ->
                    new src.domain.dungeon.published.DungeonEditorPreview.StairCreatePreview(
                            DungeonEditorValueProjectionServiceAssembly.cell(stair.anchor()),
                            stair.shapeName());
            case DungeonEditorSessionValues.MoveHandlePreview moveHandle ->
                    new src.domain.dungeon.published.DungeonEditorPreview.MoveHandlePreview(
                            DungeonEditorValueProjectionServiceAssembly.handleRef(moveHandle.handleRef()),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel());
            case DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch ->
                    new src.domain.dungeon.published.DungeonEditorPreview.MoveBoundaryStretchPreview(
                            stretch.clusterId(),
                            edges(stretch.sourceEdges()),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
            case DungeonEditorSessionValues.CorridorCreatePreview ignored -> src.domain.dungeon.published.DungeonEditorPreview.none();
            case DungeonEditorSessionValues.DeleteCorridorPreview ignored -> src.domain.dungeon.published.DungeonEditorPreview.none();
            case DungeonEditorSessionValues.NoPreview ignored -> src.domain.dungeon.published.DungeonEditorPreview.none();
        };
    }

    private static List<src.domain.dungeon.published.DungeonEdgeRef> edges(
            List<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Edge> edges
    ) {
        List<src.domain.dungeon.published.DungeonEdgeRef> result = new ArrayList<>();
        for (src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Edge edge
                : edges == null ? List.<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Edge>of() : edges) {
            result.add(DungeonEditorValueProjectionServiceAssembly.edge(edge));
        }
        return List.copyOf(result);
    }
}
