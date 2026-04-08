package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridPath;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

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

    ResolvedSegmentEndpoints resolveEndpoints(
            Map<Long, CorridorInputNode> nodesById,
            CorridorResolutionInput resolutionInput
    ) {
        CorridorInputNode startNode = requiredNode(nodesById, startNodeId);
        CorridorInputNode endNode = requiredNode(nodesById, endNodeId);
        return new ResolvedSegmentEndpoints(
                this,
                resolvedNode(startNode, resolutionInput),
                resolvedNode(endNode, resolutionInput));
    }

    CorridorPathTrace route(
            ResolvedSegmentEndpoints endpoints,
            RoutingContext context,
            CorridorPathTrace reusableTrace
    ) {
        if (reusableTrace != null) {
            return reusableTrace;
        }
        return CorridorRouting.routeSegmentProjection(
                Objects.requireNonNull(endpoints, "endpoints"),
                Objects.requireNonNull(context, "context"));
    }

    CorridorPathTrace recoverTrace(
            ResolvedSegmentEndpoints endpoints,
            GridArea surfaceArea,
            GridArea consumedNonNodeArea,
            GridArea fixedNodeArea
    ) {
        return CorridorRouting.recoverSegmentTrace(
                Objects.requireNonNull(endpoints, "endpoints"),
                surfaceArea == null ? GridArea.empty() : surfaceArea,
                consumedNonNodeArea == null ? GridArea.empty() : consumedNonNodeArea,
                fixedNodeArea == null ? GridArea.empty() : fixedNodeArea);
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
            int levelZ,
            GridArea blockedArea,
            GridArea reservedArea,
            GridBoundary occupiedConnectionBoundary
    ) {
        public RoutingContext {
            blockedArea = blockedArea == null ? GridArea.empty() : blockedArea;
            reservedArea = reservedArea == null ? GridArea.empty() : reservedArea;
            occupiedConnectionBoundary = occupiedConnectionBoundary == null
                    ? GridBoundary.empty()
                    : occupiedConnectionBoundary;
        }
    }

    record ResolvedSegmentEndpoints(
            CorridorSegment segment,
            CorridorRouting.ResolvedNode start,
            CorridorRouting.ResolvedNode end
    ) {
        public ResolvedSegmentEndpoints {
            segment = Objects.requireNonNull(segment, "segment");
            start = Objects.requireNonNull(start, "start");
            end = Objects.requireNonNull(end, "end");
        }
    }
}
