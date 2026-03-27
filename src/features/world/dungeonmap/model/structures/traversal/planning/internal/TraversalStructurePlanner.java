package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.Point2i;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class TraversalStructurePlanner {

    private TraversalStructurePlanner() {
        throw new AssertionError("No instances");
    }

    public static StructurePlan plan(TraversalTopology topology) {
        TraversalTopology resolvedTopology = topology == null ? TraversalTopology.empty() : topology;
        List<GuideNode> guideNodes = resolvedTopology.hasWaypoints()
                ? waypointGuideNodes(resolvedTopology.waypointNodes())
                : portalGuideNodes(resolvedTopology.roomPortals());
        return new StructurePlan(
                resolvedTopology,
                guideNodes,
                guideSegments(guideNodes),
                attachedPortalIndices(resolvedTopology));
    }

    private static List<GuideNode> portalGuideNodes(List<TraversalTopology.RoomPortal> roomPortals) {
        if (roomPortals == null || roomPortals.isEmpty()) {
            return List.of();
        }
        ArrayList<GuideNode> result = new ArrayList<>();
        for (int index = 0; index < roomPortals.size(); index++) {
            TraversalTopology.RoomPortal roomPortal = roomPortals.get(index);
            if (roomPortal == null || roomPortal.guideCell() == null) {
                continue;
            }
            result.add(new GuideNode(
                    "portal:" + index,
                    GuideNodeKind.ROOM_PORTAL,
                    roomPortal.guideCell(),
                    roomPortal.primaryLevel(),
                    roomPortal.roomId()));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<GuideNode> waypointGuideNodes(List<TraversalTopology.WaypointNode> waypointNodes) {
        if (waypointNodes == null || waypointNodes.isEmpty()) {
            return List.of();
        }
        ArrayList<GuideNode> result = new ArrayList<>();
        for (TraversalTopology.WaypointNode waypointNode : waypointNodes) {
            if (waypointNode == null || waypointNode.cell() == null) {
                continue;
            }
            result.add(new GuideNode(
                    "waypoint:" + waypointNode.index(),
                    GuideNodeKind.WAYPOINT,
                    waypointNode.guideCell(),
                    waypointNode.levelZ(),
                    null));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<GuideSegment> guideSegments(List<GuideNode> guideNodes) {
        if (guideNodes == null || guideNodes.size() < 2) {
            return List.of();
        }
        ArrayList<GuideSegment> result = new ArrayList<>();
        for (int index = 1; index < guideNodes.size(); index++) {
            result.add(new GuideSegment(guideNodes.get(index - 1), guideNodes.get(index)));
        }
        return List.copyOf(result);
    }

    private static List<Integer> attachedPortalIndices(TraversalTopology topology) {
        if (topology == null || !topology.hasWaypoints() || topology.roomPortals().isEmpty()) {
            return List.of();
        }
        ArrayList<Integer> result = new ArrayList<>();
        for (int index = 0; index < topology.roomPortals().size(); index++) {
            if (topology.roomPortals().get(index) != null) {
                result.add(index);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    public enum GuideNodeKind {
        ROOM_PORTAL,
        WAYPOINT
    }

    public record StructurePlan(
            TraversalTopology topology,
            List<GuideNode> guideNodes,
            List<GuideSegment> guideSegments,
            List<Integer> attachedPortalIndices
    ) {
        public StructurePlan {
            topology = topology == null ? TraversalTopology.empty() : topology;
            guideNodes = guideNodes == null ? List.of() : List.copyOf(guideNodes);
            guideSegments = guideSegments == null ? List.of() : List.copyOf(guideSegments);
            attachedPortalIndices = normalizeAttachedPortalIndices(attachedPortalIndices);
        }

        public static StructurePlan empty() {
            return new StructurePlan(TraversalTopology.empty(), List.of(), List.of(), List.of());
        }

        public boolean hasWaypointBackbone() {
            for (GuideNode guideNode : guideNodes) {
                if (guideNode != null && guideNode.kind() == GuideNodeKind.WAYPOINT) {
                    return true;
                }
            }
            return false;
        }

        private static List<Integer> normalizeAttachedPortalIndices(List<Integer> attachedPortalIndices) {
            if (attachedPortalIndices == null || attachedPortalIndices.isEmpty()) {
                return List.of();
            }
            ArrayList<Integer> result = new ArrayList<>();
            for (Integer index : attachedPortalIndices) {
                if (index != null && index >= 0) {
                    result.add(index);
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }
    }

    public record GuideNode(
            String nodeId,
            GuideNodeKind kind,
            Point2i guideCell,
            Integer levelZ,
            Long roomId
    ) {
        public GuideNode {
            Objects.requireNonNull(nodeId, "nodeId");
            Objects.requireNonNull(kind, "kind");
            Objects.requireNonNull(guideCell, "guideCell");
            levelZ = levelZ == null ? 0 : levelZ;
        }
    }

    public record GuideSegment(
            GuideNode start,
            GuideNode end
    ) {
        public GuideSegment {
            Objects.requireNonNull(start, "start");
            Objects.requireNonNull(end, "end");
        }
    }
}
