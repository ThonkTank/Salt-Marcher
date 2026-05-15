package src.domain.dungeon.model.editor.helper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorProjectionIndexProjectionHelper {

    private DungeonEditorProjectionIndexProjectionHelper() {
    }

    public static Map<String, DungeonEditorWorkspaceValues.Area> indexAreas(List<DungeonEditorWorkspaceValues.Area> areas) {
        Map<String, DungeonEditorWorkspaceValues.Area> result = new LinkedHashMap<>();
        for (DungeonEditorWorkspaceValues.Area area : areas) {
            result.put(topologyKey(area.topologyRef()), area);
        }
        return result;
    }

    public static Map<String, DungeonEditorWorkspaceValues.Boundary> indexBoundaries(
            List<DungeonEditorWorkspaceValues.Boundary> boundaries
    ) {
        Map<String, DungeonEditorWorkspaceValues.Boundary> result = new LinkedHashMap<>();
        for (DungeonEditorWorkspaceValues.Boundary boundary : boundaries) {
            result.put(topologyKey(boundary.topologyRef()), boundary);
        }
        return result;
    }

    public static Map<String, DungeonEditorWorkspaceValues.Handle> indexHandles(List<DungeonEditorWorkspaceValues.Handle> handles) {
        Map<String, DungeonEditorWorkspaceValues.Handle> result = new LinkedHashMap<>();
        for (DungeonEditorWorkspaceValues.Handle handle : handles) {
            result.put(handleKey(handle.ref()), handle);
        }
        return result;
    }

    public static DungeonEditorWorkspaceValues.@Nullable Handle clusterLabelHandle(
            @Nullable List<DungeonEditorWorkspaceValues.Handle> handles,
            long clusterId
    ) {
        if (handles == null || clusterId <= 0L) {
            return null;
        }
        for (DungeonEditorWorkspaceValues.Handle handle : handles) {
            if (handle != null
                    && handle.ref().kind().isClusterLabel()
                    && handle.ref().clusterId() == clusterId) {
                return handle;
            }
        }
        return null;
    }

    public static String topologyKey(DungeonEditorWorkspaceValues.@Nullable TopologyElementRef topologyRef) {
        DungeonEditorWorkspaceValues.TopologyElementRef safeRef = topologyRef == null
                ? DungeonEditorWorkspaceValues.TopologyElementRef.empty()
                : topologyRef;
        return safeRef.kind().name() + ":" + safeRef.id();
    }

    public static String handleKey(DungeonEditorWorkspaceValues.@Nullable HandleRef handleRef) {
        DungeonEditorWorkspaceValues.HandleRef safeRef = handleRef == null
                ? DungeonEditorProjectionPublishedBoundaryTranslationHelper.emptyWorkspaceHandleRef(0L, 0L)
                : handleRef;
        return safeRef.kind().name()
                + ":" + topologyKey(safeRef.topologyRef())
                + ":" + safeRef.ownerId()
                + ":" + safeRef.clusterId()
                + ":" + safeRef.corridorId()
                + ":" + safeRef.roomId()
                + ":" + safeRef.index();
    }
}
