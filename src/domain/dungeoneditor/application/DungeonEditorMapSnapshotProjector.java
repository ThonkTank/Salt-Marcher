package src.domain.dungeoneditor;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorCell;
import src.domain.dungeoneditor.published.DungeonEditorEdge;
import src.domain.dungeoneditor.published.DungeonEditorHandleRef;
import src.domain.dungeoneditor.published.DungeonEditorMapSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorTopologyElementRef;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorMapSnapshotProjector {

    private DungeonEditorMapSnapshotProjector() {
    }

    public static DungeonEditorMapSnapshot toPublishedMap(DungeonEditorWorkspaceValues.@Nullable MapSnapshot map) {
        DungeonEditorWorkspaceValues.MapSnapshot safeMap = map == null
                ? DungeonEditorWorkspaceValues.MapSnapshot.empty()
                : map;
        return new DungeonEditorMapSnapshot(
                safeMap.topology().name(),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(DungeonEditorMapSnapshotProjector::toPublishedArea).toList(),
                safeMap.boundaries().stream().map(DungeonEditorMapSnapshotProjector::toPublishedBoundary).toList(),
                safeMap.features().stream().map(DungeonEditorMapSnapshotProjector::toPublishedFeature).toList(),
                safeMap.editorHandles().stream().map(DungeonEditorMapSnapshotProjector::toPublishedEditorHandle).toList());
    }

    private static DungeonEditorMapSnapshot.Area toPublishedArea(DungeonEditorWorkspaceValues.@Nullable Area area) {
        if (area == null) {
            return new DungeonEditorMapSnapshot.Area("ROOM", 1L, "ROOM", List.of());
        }
        return new DungeonEditorMapSnapshot.Area(
                area.kind().name(),
                area.id(),
                area.label(),
                area.cells().stream().map(DungeonEditorPublishedValueProjector::toPublishedCell).toList());
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
                DungeonEditorPublishedValueProjector.toPublishedEdge(boundary.edge()),
                DungeonEditorPublishedValueProjector.toPublishedTopologyRef(boundary.topologyRef()));
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
                feature.cells().stream().map(DungeonEditorPublishedValueProjector::toPublishedCell).toList(),
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
                DungeonEditorPublishedValueProjector.toPublishedHandleRefOrEmpty(handle.ref()),
                handle.label(),
                DungeonEditorPublishedValueProjector.toPublishedCell(handle.cell()));
    }
}
