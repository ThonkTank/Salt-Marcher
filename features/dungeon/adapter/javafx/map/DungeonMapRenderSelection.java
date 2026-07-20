package features.dungeon.adapter.javafx.map;

import features.dungeon.api.DungeonEditorHandleRef;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.editor.DungeonEditorSelection;
import features.dungeon.adapter.javafx.map.DungeonMapRenderState.CellKind;

final class DungeonMapRenderSelection {

    private DungeonMapRenderSelection() {
    }

    static boolean selectedArea(
            DungeonEditorMapSnapshot.Area area,
            DungeonEditorSelection selection
    ) {
        if (selection == null) {
            return false;
        }
        if (selection.clusterSelection()) {
            return DungeonMapRenderCells.areaKind(area) == CellKind.ROOM
                    && DungeonMapRenderCells.clusterId(area) == selection.clusterId();
        }
        return DungeonMapRenderCells.areaTopologyRef(area)
                .equals(DungeonMapRenderElementFactory.topologyRef(selection.topologyRef()));
    }

    static boolean selectedAreaSurface(
            DungeonEditorMapSnapshot.Area area,
            DungeonEditorSelection selection
    ) {
        return selection != null
                && !selection.clusterSelection()
                && DungeonMapRenderCells.areaTopologyRef(area)
                .equals(DungeonMapRenderElementFactory.topologyRef(selection.topologyRef()));
    }

    static boolean selectedFeature(
            DungeonEditorMapSnapshot.Feature feature,
            DungeonEditorSelection selection
    ) {
        return DungeonMapRenderCells.featureTopologyRef(feature)
                .equals(DungeonMapRenderElementFactory.topologyRef(selection.topologyRef()));
    }

    static boolean selectedBoundary(
            DungeonEditorMapSnapshot.Boundary boundary,
            DungeonEditorSelection selection
    ) {
        return DungeonMapRenderElementFactory.topologyRef(boundary.topologyRef())
                .equals(DungeonMapRenderElementFactory.topologyRef(selection.topologyRef()));
    }

    static boolean selectedHandle(
            DungeonEditorHandleRef ref,
            DungeonEditorSelection selection
    ) {
        DungeonEditorHandleRef selected = selection.handleRef();
        return selected != null
                && sameHandleRef(ref, selected);
    }

    static boolean selectedClusterLabel(
            DungeonEditorHandleSnapshot handle,
            DungeonEditorSelection selection
    ) {
        if (selection.clusterSelection()) {
            return handle.ref().clusterId() > 0L && handle.ref().clusterId() == selection.clusterId();
        }
        return selectedHandle(handle.ref(), selection);
    }

    static boolean sameHandleRef(DungeonEditorHandleRef first, DungeonEditorHandleRef second) {
        return first != null
                && second != null
                && first.kind() == second.kind()
                && DungeonMapRenderElementFactory.topologyRef(first.topologyRef())
                .equals(DungeonMapRenderElementFactory.topologyRef(second.topologyRef()))
                && first.ownerId() == second.ownerId()
                && first.clusterId() == second.clusterId()
                && first.corridorId() == second.corridorId()
                && first.roomId() == second.roomId()
                && first.index() == second.index();
    }
}
