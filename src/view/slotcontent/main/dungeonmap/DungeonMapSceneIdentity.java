package src.view.slotcontent.main.dungeonmap;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.features.dungeon.runtime.DungeonEditorCellHitRefs;
import src.features.dungeon.runtime.DungeonEditorEdgeHitRefs;
import src.features.dungeon.runtime.DungeonEditorGraphHitRefs;
import src.features.dungeon.runtime.DungeonEditorLabelHitRefs;
import src.features.dungeon.runtime.DungeonEditorMarkerHitRefs;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedLabelKind;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedTopologyKind;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.BoundaryTarget;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PointerTarget;

final class DungeonMapSceneIdentity {

    private DungeonMapSceneIdentity() {
    }

    static boolean sameTopologyRef(
            DungeonMapRenderState.TopologyRef first,
            DungeonMapRenderState.TopologyRef second
    ) {
        return Objects.equals(first, second);
    }

    static @Nullable String selectionRef(DungeonMapRenderState.TopologyRef topologyRef) {
        if (topologyRef == null || topologyRef.isEmpty()) {
            return null;
        }
        return topologyRef.kind().name() + ":" + topologyRef.id();
    }

    static String cellHitRef(DungeonMapRenderState.Cell cell) {
        if (cell.preview()) {
            return "";
        }
        return DungeonEditorCellHitRefs.exactCell(
                        cell.kind().name(),
                        cell.ownerId(),
                        cell.clusterId(),
                        cell.topologyRef().kind().name(),
                        cell.topologyRef().id(),
                        cell.q(),
                        cell.r(),
                        cell.z())
                .value();
    }

    static String edgeHitRef(DungeonMapRenderState.Edge edge) {
        if (edge.preview()) {
            return "";
        }
        return DungeonEditorEdgeHitRefs.edge(
                        edge.kind().name(),
                        edge.ownerId(),
                        edge.topologyRef().kind().name(),
                        edge.topologyRef().id(),
                        edge.z(),
                        edge.startQ(),
                        edge.startR(),
                        edge.endQ(),
                        edge.endR())
                .value();
    }

    static String labelHitRef(DungeonMapRenderState.Label label) {
        if (label.preview() || label.labelKind() == PreparedLabelKind.ROOM_LABEL) {
            return "";
        }
        return DungeonEditorLabelHitRefs.label(
                        label.ownerId(),
                        label.clusterId(),
                        label.topologyRef().kind().name(),
                        label.topologyRef().id(),
                        label.labelKind().name())
                .value();
    }

    static String markerHitRef(DungeonMapRenderState.Marker marker) {
        if (marker.preview()) {
            return "";
        }
        DungeonMapRenderState.MarkerHandle handle = marker.handle();
        if (handle.kind() == null) {
            DungeonMapRenderState.TopologyRef topologyRef = handle.topologyRef();
            return topologyRef.equals(DungeonMapRenderState.TopologyRef.empty())
                    || !featureMarkerTopology(topologyRef)
                    ? ""
                    : DungeonEditorMarkerHitRefs.featureMarker(
                            topologyRef.kind().name(),
                            topologyRef.id(),
                            topologyRef.id(),
                            (int) Math.floor(marker.q()),
                            (int) Math.floor(marker.r()),
                            marker.z())
                    .value();
        }
        return DungeonEditorMarkerHitRefs.marker(
                        handle.ref(),
                        handle.q(),
                        handle.r(),
                        handle.level())
                .value();
    }

    static String graphNodeHitRef(DungeonMapRenderState.GraphNode node) {
        return DungeonEditorGraphHitRefs.graphNode(node.id(), node.clusterId()).value();
    }

    private static boolean featureMarkerTopology(DungeonMapRenderState.TopologyRef topologyRef) {
        return topologyRef.kind() == PreparedTopologyKind.TRANSITION
                || topologyRef.kind() == PreparedTopologyKind.FEATURE_MARKER;
    }

    static final class Hover {

        private Hover() {
        }

    static boolean hoveredCell(PointerTarget target, DungeonMapRenderState.Cell cell) {
        DungeonMapContentModel.PointerTarget safeTarget = DungeonMapContentModel.selectableHoverTarget(target);
        boolean sameCellOwner = safeTarget.isCellTarget()
                && sameTopologyRef(safeTarget.topologyRef(), cell.topologyRef())
                && safeTarget.ownerId() == cell.ownerId()
                && safeTarget.clusterId() == cell.clusterId()
                && safeTarget.elementKind() == DungeonMapContentModel.preparedCellElementKind(cell.kind());
        if (!sameCellOwner) {
            return false;
        }
        DungeonMapContentModel.CellTarget cellRef = safeTarget.cellRef();
        return !cellRef.exact()
                || cellRef.q() == cell.q()
                && cellRef.r() == cell.r()
                && cellRef.level() == cell.z();
    }

    static boolean hoveredEdge(PointerTarget target, DungeonMapRenderState.Edge edge) {
        DungeonMapContentModel.PointerTarget safeTarget = DungeonMapContentModel.selectableHoverTarget(target);
        boolean sameBoundaryOwner = safeTarget.isBoundaryTarget()
                && safeTarget.ownerId() == edge.ownerId()
                && sameTopologyRef(safeTarget.topologyRef(), edge.topologyRef());
        if (!sameBoundaryOwner) {
            return false;
        }
        BoundaryTarget boundaryRef = safeTarget.boundaryRef();
        return boundaryRef.key().isBlank()
                || boundaryRef.startQ() == edge.startQ()
                && boundaryRef.startR() == edge.startR()
                && boundaryRef.startLevel() == edge.z()
                && boundaryRef.endQ() == edge.endQ()
                && boundaryRef.endR() == edge.endR()
                && boundaryRef.endLevel() == edge.z();
    }

    static boolean hoveredMarker(PointerTarget target, DungeonMapRenderState.Marker marker) {
        DungeonMapContentModel.PointerTarget safeTarget = DungeonMapContentModel.selectableHoverTarget(target);
        if (safeTarget.isHandleTarget()) {
            return safeTarget.handleRef().equals(marker.handle().ref());
        }
        return safeTarget.isMarkerTarget()
                && sameTopologyRef(safeTarget.topologyRef(), marker.handle().topologyRef())
                && safeTarget.ownerId() == marker.handle().topologyRef().id();
    }

    static boolean hoveredLabel(PointerTarget target, DungeonMapRenderState.Label label) {
        DungeonMapContentModel.PointerTarget safeTarget = DungeonMapContentModel.selectableHoverTarget(target);
        return safeTarget.isLabelTarget()
                && label.labelKind() != PreparedLabelKind.ROOM_LABEL
                && safeTarget.labelKind() == label.labelKind()
                && sameTopologyRef(safeTarget.topologyRef(), label.topologyRef())
                && safeTarget.ownerId() == label.ownerId()
                && safeTarget.clusterId() == label.clusterId();
    }

    static boolean hoveredGraphNode(PointerTarget target, DungeonMapRenderState.GraphNode node) {
        DungeonMapContentModel.PointerTarget safeTarget = DungeonMapContentModel.selectableHoverTarget(target);
        return safeTarget.isGraphNodeTarget()
                && safeTarget.topologyKind() == PreparedTopologyKind.ROOM
                && safeTarget.topologyId() == node.id()
                && safeTarget.ownerId() == node.id()
                && safeTarget.clusterId() == node.clusterId();
    }

    }

    static boolean includeLevel(DungeonMapRenderState displayModel, int level) {
        if (level == displayModel.projectionLevel()) {
            return true;
        }
        DungeonMapRenderState.LevelOverlaySettings settings = displayModel.overlaySettings();
        return switch (settings.mode()) {
            case OFF -> false;
            case NEARBY -> Math.abs(level - displayModel.projectionLevel()) <= settings.levelRange();
            case SELECTED -> settings.selectsLevel(level);
        };
    }
}
