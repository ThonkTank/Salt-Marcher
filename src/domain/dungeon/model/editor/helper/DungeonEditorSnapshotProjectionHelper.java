package src.domain.dungeon.model.editor.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorOverlaySettings;
import src.domain.dungeon.published.DungeonEditorSnapshot;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;

public final class DungeonEditorSnapshotProjectionHelper {

    private DungeonEditorSnapshotProjectionHelper() {
    }

    public static DungeonEditorSnapshot toPublishedSnapshot(
            DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot
    ) {
        DungeonEditorSessionSnapshot.SnapshotData safeSnapshot = snapshot == null
                ? DungeonEditorSessionSnapshot.SnapshotData.empty("")
                : snapshot;
        return new DungeonEditorSnapshot(
                safeSnapshot.maps().stream().map(DungeonEditorSurfaceProjectionHelper::toPublishedMapSummary).toList(),
                DungeonEditorSurfaceProjectionHelper.toPublishedMapId(safeSnapshot.selectedMapId()),
                toPublishedViewMode(safeSnapshot.viewMode()),
                toPublishedTool(safeSnapshot.selectedTool()),
                safeSnapshot.projectionLevel(),
                toPublishedOverlay(safeSnapshot.overlaySettings()),
                toPublishedSelection(safeSnapshot.selection()),
                DungeonEditorSurfaceProjectionHelper.toPublishedSurface(safeSnapshot.surface()),
                toPublishedPreview(safeSnapshot.preview()),
                DungeonEditorMapProjectionHelper.projection(
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
                DungeonEditorPublishedValueProjectionHelper.toPublishedTopologyRef(safeSelection.topologyRef()),
                safeSelection.clusterId(),
                safeSelection.clusterSelection(),
                safeSelection.handleRef().equals(DungeonEditorSessionValues.emptyHandleRef())
                        ? null
                        : DungeonEditorPublishedValueProjectionHelper.toPublishedHandleRefOrEmpty(safeSelection.handleRef()));
    }

    private static DungeonEditorPreview toPublishedPreview(DungeonEditorSessionValues.@Nullable Preview preview) {
        if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
            return DungeonEditorPreview.none();
        }
        return switch (preview) {
            case DungeonEditorSessionValues.RoomRectanglePreview room ->
                    new DungeonEditorPreview.RoomRectanglePreview(
                            DungeonEditorPublishedValueProjectionHelper.toPublishedCell(room.start()),
                            DungeonEditorPublishedValueProjectionHelper.toPublishedCell(room.end()),
                            room.deleteMode());
            case DungeonEditorSessionValues.ClusterBoundariesPreview boundaries ->
                    new DungeonEditorPreview.ClusterBoundariesPreview(
                            boundaries.clusterId(),
                            boundaries.edges().stream().map(DungeonEditorPublishedValueProjectionHelper::toPublishedEdge).toList(),
                            boundaries.boundaryKind().name(),
                            boundaries.deleteMode());
            case DungeonEditorSessionValues.MoveHandlePreview moveHandle ->
                    new DungeonEditorPreview.MoveHandlePreview(
                            DungeonEditorPublishedValueProjectionHelper.toPublishedHandleRefOrEmpty(moveHandle.handleRef()),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel());
            case DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch ->
                    new DungeonEditorPreview.MoveBoundaryStretchPreview(
                            stretch.clusterId(),
                            stretch.sourceEdges().stream().map(DungeonEditorPublishedValueProjectionHelper::toPublishedEdge).toList(),
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
