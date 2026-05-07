package src.domain.dungeoneditor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorProjectionSelectionProjector {

    private DungeonEditorProjectionSelectionProjector() {
    }

    public static boolean selectedArea(
            DungeonEditorWorkspaceValues.@Nullable Area area,
            DungeonEditorSessionValues.@Nullable Selection selection
    ) {
        if (area == null || selection == null) {
            return false;
        }
        if (selection.clusterSelection()) {
            return area.kind().isRoom() && area.clusterId() == selection.clusterId();
        }
        return DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(area.topologyRef()).equals(
                DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(selection.topologyRef()));
    }

    public static boolean selectedFeature(
            DungeonEditorWorkspaceValues.@Nullable Feature feature,
            DungeonEditorSessionValues.@Nullable Selection selection
    ) {
        return feature != null
                && selection != null
                && DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(feature.topologyRef()).equals(
                        DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(selection.topologyRef()));
    }

    public static boolean selectedBoundary(
            DungeonEditorWorkspaceValues.@Nullable Boundary boundary,
            DungeonEditorSessionValues.@Nullable Selection selection
    ) {
        return boundary != null
                && selection != null
                && DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(boundary.topologyRef()).equals(
                        DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(selection.topologyRef()));
    }

    public static boolean selectedHandle(
            DungeonEditorWorkspaceValues.@Nullable HandleRef ref,
            DungeonEditorSessionValues.@Nullable Selection selection
    ) {
        if (ref == null
                || selection == null
                || selection.handleRef().equals(DungeonEditorSessionValues.emptyHandleRef())) {
            return false;
        }
        DungeonEditorWorkspaceValues.HandleRef selected = selection.handleRef();
        return ref.kind() == selected.kind()
                && DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(ref.topologyRef()).equals(
                        DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(selected.topologyRef()))
                && ref.ownerId() == selected.ownerId()
                && ref.clusterId() == selected.clusterId()
                && ref.corridorId() == selected.corridorId()
                && ref.roomId() == selected.roomId()
                && ref.index() == selected.index();
    }

    public static boolean selectedClusterLabel(
            DungeonEditorWorkspaceValues.@Nullable Handle handle,
            DungeonEditorSessionValues.@Nullable Selection selection
    ) {
        if (handle == null || selection == null) {
            return false;
        }
        if (selection.clusterSelection()) {
            return handle.ref().clusterId() > 0L && handle.ref().clusterId() == selection.clusterId();
        }
        return selectedHandle(handle.ref(), selection);
    }

    public static boolean draggedClusterArea(
            DungeonEditorWorkspaceValues.@Nullable Area area,
            DungeonEditorSessionValues.@Nullable Selection selection,
            DungeonEditorSessionValues.MoveHandlePreview movePreview
    ) {
        if (area == null || !movePreview.handleRef().kind().isClusterLabel()) {
            return false;
        }
        long selectedClusterId = selection == null || selection.clusterId() <= 0L
                ? movePreview.handleRef().clusterId()
                : selection.clusterId();
        return selectedClusterId > 0L
                && area.kind().isRoom()
                && area.clusterId() == selectedClusterId;
    }
}
