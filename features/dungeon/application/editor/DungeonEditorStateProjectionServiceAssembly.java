package features.dungeon.application.editor;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorSessionSnapshot;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.api.DungeonEditorStateSnapshot;
import features.dungeon.api.DungeonEditorSurface;

final class DungeonEditorStateProjectionServiceAssembly {

    private DungeonEditorStateProjectionServiceAssembly() {
    }

    static features.dungeon.api.DungeonEditorStateSnapshot snapshot(
            features.dungeon.application.editor.session.DungeonEditorSessionSnapshot.SnapshotData snapshot,
            @Nullable DungeonEditorSurface surface
    ) {
        return new features.dungeon.api.DungeonEditorStateSnapshot(
                selection(snapshot.selection()),
                surface == null ? null : surface.inspector(),
                preview(snapshot.preview()),
                snapshot.statusText(),
                DungeonEditorValueProjectionServiceAssembly.viewMode(snapshot.viewMode()),
                DungeonEditorValueProjectionServiceAssembly.tool(snapshot.selectedTool()),
                DungeonEditorValueProjectionServiceAssembly.overlay(snapshot.overlaySettings()),
                snapshot.projectionLevel());
    }

    static DungeonEditorStateSnapshot snapshot(
            DungeonEditorSessionSnapshot.SessionFrameData frameData,
            DungeonEditorStateSnapshot current
    ) {
        DungeonEditorSessionSnapshot.SessionFrameData safeFrameData =
                frameData == null ? DungeonEditorSessionSnapshot.sessionFrameData(null) : frameData;
        DungeonEditorStateSnapshot safeCurrent = current == null
                ? DungeonEditorStateSnapshot.empty(safeFrameData.statusText())
                : current;
        return new DungeonEditorStateSnapshot(
                selection(safeFrameData.selection()),
                safeCurrent.inspector(),
                preview(safeFrameData.preview()),
                safeFrameData.statusText(),
                DungeonEditorValueProjectionServiceAssembly.viewMode(safeFrameData.viewMode()),
                DungeonEditorValueProjectionServiceAssembly.tool(safeFrameData.selectedTool()),
                DungeonEditorValueProjectionServiceAssembly.overlay(safeFrameData.overlaySettings()),
                safeFrameData.projectionLevel());
    }

    static features.dungeon.api.DungeonEditorStateSnapshot.Selection selection(
            DungeonEditorSessionValues.@Nullable Selection selection
    ) {
        DungeonEditorSessionValues.Selection safeSelection = selection == null
                ? DungeonEditorSessionValues.Selection.empty()
                : selection;
        return new features.dungeon.api.DungeonEditorStateSnapshot.Selection(
                DungeonEditorValueProjectionServiceAssembly.topologyRef(safeSelection.topologyRef()),
                safeSelection.clusterId(),
                safeSelection.clusterSelection(),
                safeSelection.handleRef().equals(DungeonEditorSessionValues.emptyHandleRef())
                        ? null
                        : DungeonEditorValueProjectionServiceAssembly.handleRef(safeSelection.handleRef()));
    }

    static features.dungeon.api.DungeonEditorPreview preview(DungeonEditorSessionValues.@Nullable Preview preview) {
        if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
            return features.dungeon.api.DungeonEditorPreview.none();
        }
        return switch (preview) {
            case DungeonEditorSessionValues.RoomRectanglePreview room ->
                    new features.dungeon.api.DungeonEditorPreview.RoomRectanglePreview(
                            DungeonEditorValueProjectionServiceAssembly.cell(room.start()),
                            DungeonEditorValueProjectionServiceAssembly.cell(room.end()),
                            room.deleteMode());
            case DungeonEditorSessionValues.ClusterBoundariesPreview boundaries ->
                    new features.dungeon.api.DungeonEditorPreview.ClusterBoundariesPreview(
                            boundaries.clusterId(),
                            edges(boundaries.edges()),
                            boundaries.boundaryKind().name(),
                            boundaries.deleteMode());
            case DungeonEditorSessionValues.StairCreatePreview stair ->
                    new features.dungeon.api.DungeonEditorPreview.StairCreatePreview(
                            DungeonEditorValueProjectionServiceAssembly.cell(stair.anchor()),
                            DungeonEditorValueProjectionServiceAssembly.cell(stair.end()),
                            stair.shapeName(),
                            stair.valid(),
                            stair.statusText());
            case DungeonEditorSessionValues.MoveHandlePreview moveHandle ->
                    new features.dungeon.api.DungeonEditorPreview.MoveHandlePreview(
                            DungeonEditorValueProjectionServiceAssembly.handleRef(moveHandle.handleRef()),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel());
            case DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch ->
                    new features.dungeon.api.DungeonEditorPreview.MoveBoundaryStretchPreview(
                            stretch.clusterId(),
                            edges(stretch.sourceEdges()),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
            case DungeonEditorSessionValues.CorridorCreatePreview ignored -> features.dungeon.api.DungeonEditorPreview.none();
            case DungeonEditorSessionValues.DeleteCorridorPreview ignored -> features.dungeon.api.DungeonEditorPreview.none();
            case DungeonEditorSessionValues.NoPreview ignored -> features.dungeon.api.DungeonEditorPreview.none();
        };
    }

    private static List<features.dungeon.api.DungeonEdgeRef> edges(
            List<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Edge> edges
    ) {
        List<features.dungeon.api.DungeonEdgeRef> result = new ArrayList<>();
        for (features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Edge edge
                : edges == null ? List.<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Edge>of() : edges) {
            result.add(DungeonEditorValueProjectionServiceAssembly.edge(edge));
        }
        return List.copyOf(result);
    }
}
