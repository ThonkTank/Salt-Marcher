package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridPath;
import features.world.dungeon.geometry.GridPoint;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Persisted authored corridor segment. Each segment owns endpoint resolution and local replanning.
 */
public record CorridorSegment(
        Long segmentId,
        Long startNodeId,
        Long endNodeId
) {

    public CorridorSegment {
        if (segmentId == null) {
            throw new IllegalArgumentException("Corridor segment id is required");
        }
        if (startNodeId == null || endNodeId == null) {
            throw new IllegalArgumentException("Corridor segment endpoints are required");
        }
        if (startNodeId.equals(endNodeId)) {
            throw new IllegalArgumentException("Corridor segment may not connect a node to itself");
        }
    }

    public boolean touches(Long nodeId) {
        return java.util.Objects.equals(startNodeId, nodeId) || java.util.Objects.equals(endNodeId, nodeId);
    }

    public Long otherNodeId(Long nodeId) {
        if (java.util.Objects.equals(startNodeId, nodeId)) {
            return endNodeId;
        }
        if (java.util.Objects.equals(endNodeId, nodeId)) {
            return startNodeId;
        }
        return null;
    }

    ResolvedSegment resolve(
            Map<Long, CorridorInputNode> nodesById,
            CorridorResolutionInput resolutionInput
    ) {
        CorridorInputNode startNode = requiredNode(nodesById, startNodeId);
        CorridorInputNode endNode = requiredNode(nodesById, endNodeId);
        return new ResolvedSegment(
                this,
                resolvedNode(startNode, resolutionInput),
                resolvedNode(endNode, resolutionInput));
    }

    CorridorPathTrace traceFrom(
            ResolvedSegment previous,
            CorridorPathTrace previousTrace,
            ResolvedSegment current,
            RoutingContext context
    ) {
        if (previous != null
                && previousTrace != null
                && sameResolvedShape(previous, current)) {
            return previousTrace;
        }
        return CorridorRouting.routeSegmentProjection(
                Objects.requireNonNull(current, "current"),
                Objects.requireNonNull(context, "context"));
    }

    CorridorPathTrace recoverTrace(
            ResolvedSegment resolvedSegment,
            GridArea surfaceArea,
            GridArea consumedNonNodeArea,
            GridArea fixedNodeArea
    ) {
        return CorridorRouting.recoverSegmentTrace(
                Objects.requireNonNull(resolvedSegment, "resolvedSegment"),
                surfaceArea == null ? GridArea.empty() : surfaceArea,
                consumedNonNodeArea == null ? GridArea.empty() : consumedNonNodeArea,
                fixedNodeArea == null ? GridArea.empty() : fixedNodeArea);
    }

    private static boolean sameResolvedShape(ResolvedSegment previous, ResolvedSegment current) {
        return Objects.equals(previous.start().point(), current.start().point())
                && Objects.equals(previous.end().point(), current.end().point())
                && Objects.equals(previous.start().attachments(), current.start().attachments())
                && Objects.equals(previous.end().attachments(), current.end().attachments());
    }

    private static CorridorInputNode requiredNode(Map<Long, CorridorInputNode> nodesById, Long nodeId) {
        CorridorInputNode node = nodesById == null ? null : nodesById.get(nodeId);
        if (node == null) {
            throw new IllegalArgumentException("Corridor segment references missing node " + nodeId);
        }
        return node;
    }

    private static CorridorRouting.ResolvedNode resolvedNode(
            CorridorInputNode node,
            CorridorResolutionInput resolutionInput
    ) {
        if (node.isDoorBound()) {
            CorridorResolutionInput.ExteriorDoorInput door = resolutionInput.requiredExteriorDoor(node.doorRef());
            return new CorridorRouting.ResolvedNode(
                    node.nodeId(),
                    door.anchorPoint(),
                    List.of(new CorridorRouting.AnchorAttachment(
                            door.exteriorCell(),
                            GridPath.of(List.of(door.anchorPoint(), door.exteriorCell())))),
                    true);
        }
        return new CorridorRouting.ResolvedNode(
                node.nodeId(),
                node.fixedPoint(),
                CorridorRouting.attachmentsForPoint(
                        node.fixedPoint(),
                        resolutionInput.blockedArea()),
                false);
    }

    record RoutingContext(
            GridArea blockedArea,
            GridArea reservedArea
    ) {
        public RoutingContext {
            blockedArea = blockedArea == null ? GridArea.empty() : blockedArea;
            reservedArea = reservedArea == null ? GridArea.empty() : reservedArea;
        }
    }

    record ResolvedSegment(
            CorridorSegment segment,
            CorridorRouting.ResolvedNode start,
            CorridorRouting.ResolvedNode end
    ) {
        public ResolvedSegment {
            segment = Objects.requireNonNull(segment, "segment");
            start = Objects.requireNonNull(start, "start");
            end = Objects.requireNonNull(end, "end");
        }
    }
}
