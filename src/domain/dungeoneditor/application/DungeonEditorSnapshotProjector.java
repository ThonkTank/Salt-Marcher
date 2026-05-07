package src.domain.dungeoneditor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorPreview;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;

public final class DungeonEditorSnapshotProjector {

    private DungeonEditorSnapshotProjector() {
    }

    public static DungeonEditorSnapshot toPublishedSnapshot(
            DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot
    ) {
        DungeonEditorSessionSnapshot.SnapshotData safeSnapshot = snapshot == null
                ? DungeonEditorSessionSnapshot.SnapshotData.empty("")
                : snapshot;
        return new DungeonEditorSnapshot(
                safeSnapshot.maps().stream().map(DungeonEditorSurfaceProjector::toPublishedMapSummary).toList(),
                DungeonEditorSurfaceProjector.toPublishedMapId(safeSnapshot.selectedMapId()),
                toPublishedViewMode(safeSnapshot.viewMode()),
                toPublishedTool(safeSnapshot.selectedTool()),
                safeSnapshot.projectionLevel(),
                toPublishedOverlay(safeSnapshot.overlaySettings()),
                toPublishedSelection(safeSnapshot.selection()),
                DungeonEditorSurfaceProjector.toPublishedSurface(safeSnapshot.surface()),
                toPublishedPreview(safeSnapshot.preview()),
                DungeonEditorMapProjectionProjector.projection(
                        safeSnapshot.surface(),
                        safeSnapshot.selection(),
                        safeSnapshot.preview()),
                safeSnapshot.statusText());
    }

    private static DungeonEditorOverlaySettings toPublishedOverlay(
            DungeonEditorSessionValues.@Nullable OverlaySettings overlay
    ) {
        DungeonEditorSessionValues.OverlaySettings safeOverlay = overlay == null
                ? DungeonEditorSessionValues.OverlaySettings.defaults()
                : overlay;
        return new DungeonEditorOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static DungeonEditorSnapshot.Selection toPublishedSelection(
            DungeonEditorSessionValues.@Nullable Selection selection
    ) {
        DungeonEditorSessionValues.Selection safeSelection = selection == null
                ? DungeonEditorSessionValues.Selection.empty()
                : selection;
        return new DungeonEditorSnapshot.Selection(
                DungeonEditorPublishedValueProjector.toPublishedTopologyRef(safeSelection.topologyRef()),
                safeSelection.clusterId(),
                safeSelection.clusterSelection(),
                safeSelection.handleRef().equals(DungeonEditorSessionValues.emptyHandleRef())
                        ? null
                        : DungeonEditorPublishedValueProjector.toPublishedHandleRefOrEmpty(safeSelection.handleRef()));
    }

    private static DungeonEditorPreview toPublishedPreview(DungeonEditorSessionValues.@Nullable Preview preview) {
        if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
            return DungeonEditorPreview.none();
        }
        return switch (preview) {
            case DungeonEditorSessionValues.RoomRectanglePreview room ->
                    new DungeonEditorPreview.RoomRectanglePreview(
                            DungeonEditorPublishedValueProjector.toPublishedCell(room.start()),
                            DungeonEditorPublishedValueProjector.toPublishedCell(room.end()),
                            room.deleteMode());
            case DungeonEditorSessionValues.ClusterBoundariesPreview boundaries ->
                    new DungeonEditorPreview.ClusterBoundariesPreview(
                            boundaries.clusterId(),
                            boundaries.edges().stream().map(DungeonEditorPublishedValueProjector::toPublishedEdge).toList(),
                            boundaries.boundaryKind().name(),
                            boundaries.deleteMode());
            case DungeonEditorSessionValues.MoveHandlePreview moveHandle ->
                    new DungeonEditorPreview.MoveHandlePreview(
                            DungeonEditorPublishedValueProjector.toPublishedHandleRefOrEmpty(moveHandle.handleRef()),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel());
            case DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch ->
                    new DungeonEditorPreview.MoveBoundaryStretchPreview(
                            stretch.clusterId(),
                            stretch.sourceEdges().stream().map(DungeonEditorPublishedValueProjector::toPublishedEdge).toList(),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
            case DungeonEditorSessionValues.CorridorCreatePreview ignored -> DungeonEditorPreview.none();
            case DungeonEditorSessionValues.CorridorDeletePreview ignored -> DungeonEditorPreview.none();
            case DungeonEditorSessionValues.NoPreview ignored -> DungeonEditorPreview.none();
        };
    }

    private static DungeonEditorViewMode toPublishedViewMode(DungeonEditorSessionValues.@Nullable ViewMode viewMode) {
        return viewMode == DungeonEditorSessionValues.ViewMode.GRAPH
                ? DungeonEditorViewMode.GRAPH
                : DungeonEditorViewMode.GRID;
    }

    private static DungeonEditorTool toPublishedTool(DungeonEditorSessionValues.@Nullable Tool tool) {
        return tool == null ? DungeonEditorTool.SELECT : DungeonEditorTool.valueOf(tool.name());
    }
}
