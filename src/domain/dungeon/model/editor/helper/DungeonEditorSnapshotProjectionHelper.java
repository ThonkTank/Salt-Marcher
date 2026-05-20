package src.domain.dungeon.model.editor.helper;

import java.util.ArrayList;
import java.util.List;
import java.util.SortedSet;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;

public final class DungeonEditorSnapshotProjectionHelper {

    private DungeonEditorSnapshotProjectionHelper() {
    }

    public static DungeonEditorControlsSnapshot toControlsSnapshot(
            DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot
    ) {
        DungeonEditorSessionSnapshot.SnapshotData safeSnapshot = safeSnapshot(snapshot);
        DungeonEditorSurface surface = DungeonEditorSurfaceProjectionHelper.toPublishedSurface(safeSnapshot.surface());
        return new DungeonEditorControlsSnapshot(
                safeSnapshot.maps().stream().map(DungeonEditorSurfaceProjectionHelper::toPublishedMapSummary).toList(),
                DungeonEditorSurfaceProjectionHelper.toPublishedMapId(safeSnapshot.selectedMapId()),
                toPublishedViewMode(safeSnapshot.viewMode()),
                toPublishedTool(safeSnapshot.selectedTool()),
                safeSnapshot.projectionLevel(),
                toPublishedOverlay(safeSnapshot.overlaySettings()),
                reachableLevels(surface, safeSnapshot.projectionLevel()),
                surface != null,
                safeSnapshot.statusText());
    }

    public static DungeonEditorStateSnapshot toStateSnapshot(
            DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot
    ) {
        DungeonEditorSessionSnapshot.SnapshotData safeSnapshot = safeSnapshot(snapshot);
        DungeonEditorSurface surface = DungeonEditorSurfaceProjectionHelper.toPublishedSurface(safeSnapshot.surface());
        DungeonEditorStateSnapshot.Selection selection = toPublishedSelection(safeSnapshot.selection());
        return new DungeonEditorStateSnapshot(
                selection,
                surface == null ? null : surface.inspector(),
                toPublishedPreview(safeSnapshot.preview()),
                safeSnapshot.statusText(),
                toPublishedViewMode(safeSnapshot.viewMode()),
                toPublishedTool(safeSnapshot.selectedTool()),
                toPublishedOverlay(safeSnapshot.overlaySettings()),
                safeSnapshot.projectionLevel());
    }

    public static DungeonEditorMapSurfaceSnapshot toMapSurfaceSnapshot(
            DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot
    ) {
        DungeonEditorSessionSnapshot.SnapshotData safeSnapshot = safeSnapshot(snapshot);
        return new DungeonEditorMapSurfaceSnapshot(
                DungeonEditorMapProjectionHelper.projection(
                        safeSnapshot.surface(),
                        safeSnapshot.selection(),
                        safeSnapshot.preview()),
                toPublishedViewMode(safeSnapshot.viewMode()),
                toPublishedOverlay(safeSnapshot.overlaySettings()),
                safeSnapshot.projectionLevel(),
                toPublishedTool(safeSnapshot.selectedTool()));
    }

    private static DungeonEditorSessionSnapshot.SnapshotData safeSnapshot(
            DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot
    ) {
        return snapshot == null ? DungeonEditorSessionSnapshot.SnapshotData.empty("") : snapshot;
    }

    private static DungeonOverlaySettings toPublishedOverlay(
            DungeonEditorSessionValues.@Nullable OverlaySettings overlay
    ) {
        DungeonEditorSessionValues.OverlaySettings safeOverlay = overlay == null
                ? DungeonEditorSessionValues.OverlaySettings.defaults()
                : overlay;
        return new DungeonOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static DungeonEditorStateSnapshot.Selection toPublishedSelection(
            DungeonEditorSessionValues.@Nullable Selection selection
    ) {
        DungeonEditorSessionValues.Selection safeSelection = selection == null
                ? DungeonEditorSessionValues.Selection.empty()
                : selection;
        return new DungeonEditorStateSnapshot.Selection(
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
            case DungeonEditorSessionValues.DeleteCorridorPreview ignored -> DungeonEditorPreview.none();
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

    private static List<Integer> reachableLevels(@Nullable DungeonEditorSurface surface, int fallbackLevel) {
        SortedSet<Integer> levels = new TreeSet<>();
        if (surface != null && surface.map() != null) {
            addMapLevels(levels, surface.map());
            if (surface.previewMap() != null) {
                addMapLevels(levels, surface.previewMap());
            }
        }
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return new ArrayList<>(levels);
    }

    private static void addMapLevels(SortedSet<Integer> levels, DungeonEditorMapSnapshot map) {
        map.areas().forEach(area -> addCellLevels(levels, area.cells()));
        for (DungeonEditorMapSnapshot.Feature feature : map.features()) {
            addCellLevels(levels, feature.cells());
        }
        map.editorHandles().forEach(handle -> levels.add(handle.cell().level()));
    }

    private static void addCellLevels(SortedSet<Integer> levels, List<DungeonCellRef> cells) {
        for (DungeonCellRef cell : cells == null ? List.<DungeonCellRef>of() : cells) {
            levels.add(cell.level());
        }
    }
}
