package src.domain.dungeoneditor.model.workspace.helper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorCell;
import src.domain.dungeoneditor.published.DungeonEditorEdge;
import src.domain.dungeoneditor.published.DungeonEditorHandleRef;
import src.domain.dungeoneditor.published.DungeonEditorMapSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorTopologyElementRef;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorMapSnapshotProjectionHelper {

    private DungeonEditorMapSnapshotProjectionHelper() {
    }

    public static DungeonEditorMapSnapshot toPublishedMap(DungeonEditorWorkspaceValues.@Nullable MapSnapshot map) {
        DungeonEditorWorkspaceValues.MapSnapshot safeMap = map == null
                ? DungeonEditorWorkspaceValues.MapSnapshot.empty()
                : map;
        return new DungeonEditorMapSnapshot(
                safeMap.topology().name(),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(DungeonEditorMapSnapshotProjectionHelper::toPublishedArea).toList(),
                safeMap.boundaries().stream().map(DungeonEditorMapSnapshotProjectionHelper::toPublishedBoundary).toList(),
                safeMap.features().stream().map(DungeonEditorMapSnapshotProjectionHelper::toPublishedFeature).toList(),
                safeMap.editorHandles().stream().map(DungeonEditorMapSnapshotProjectionHelper::toPublishedEditorHandle).toList());
    }

    private static DungeonEditorMapSnapshot.Area toPublishedArea(DungeonEditorWorkspaceValues.@Nullable Area area) {
        if (area == null) {
            return new DungeonEditorMapSnapshot.Area("ROOM", 1L, "ROOM", List.of());
        }
        return new DungeonEditorMapSnapshot.Area(
                area.kind().name(),
                area.id(),
                area.label(),
                area.cells().stream().map(DungeonEditorPublishedValueProjectionHelper::toPublishedCell).toList());
    }

    private static DungeonEditorMapSnapshot.Boundary toPublishedBoundary(
            DungeonEditorWorkspaceValues.@Nullable Boundary boundary
    ) {
        if (boundary == null) {
            return new DungeonEditorMapSnapshot.Boundary(
                    "boundary",
                    1L,
                    "boundary",
                    new DungeonEditorEdge(new DungeonEditorCell(0, 0, 0), new DungeonEditorCell(0, 0, 0)),
                    DungeonEditorTopologyElementRef.empty());
        }
        return new DungeonEditorMapSnapshot.Boundary(
                boundary.kind().externalKind(),
                boundary.id(),
                boundary.label(),
                DungeonEditorPublishedValueProjectionHelper.toPublishedEdge(boundary.edge()),
                DungeonEditorPublishedValueProjectionHelper.toPublishedTopologyRef(boundary.topologyRef()));
    }

    private static DungeonEditorMapSnapshot.Feature toPublishedFeature(
            DungeonEditorWorkspaceValues.@Nullable Feature feature
    ) {
        if (feature == null) {
            return new DungeonEditorMapSnapshot.Feature("STAIR", 1L, "STAIR", List.of(), "", "");
        }
        return new DungeonEditorMapSnapshot.Feature(
                feature.kind().name(),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(DungeonEditorPublishedValueProjectionHelper::toPublishedCell).toList(),
                feature.description(),
                feature.destinationLabel());
    }

    private static DungeonEditorMapSnapshot.EditorHandle toPublishedEditorHandle(
            DungeonEditorWorkspaceValues.@Nullable Handle handle
    ) {
        if (handle == null) {
            return new DungeonEditorMapSnapshot.EditorHandle(
                    DungeonEditorHandleRef.empty(),
                    "CLUSTER_LABEL",
                    new DungeonEditorCell(0, 0, 0));
        }
        return new DungeonEditorMapSnapshot.EditorHandle(
                DungeonEditorPublishedValueProjectionHelper.toPublishedHandleRefOrEmpty(handle.ref()),
                handle.label(),
                DungeonEditorPublishedValueProjectionHelper.toPublishedCell(handle.cell()));
    }
}
