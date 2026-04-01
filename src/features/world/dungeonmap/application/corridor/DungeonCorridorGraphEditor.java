package features.world.dungeonmap.application.corridor;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.corridor.CorridorSegment;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DungeonCorridorGraphEditor {

    private DungeonCorridorGraphEditor() {
        throw new AssertionError("No instances");
    }

    public static Corridor withMovedNode(DungeonLayout layout, Corridor corridor, Long nodeId, GridPoint2x point2x) {
        if (layout == null || corridor == null || nodeId == null || point2x == null) {
            return corridor;
        }
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>();
        for (CorridorNode node : corridor.nodes()) {
            if (node == null) {
                continue;
            }
            if (!nodeId.equals(node.nodeId())) {
                updatedNodes.add(node);
                continue;
            }
            updatedNodes.add(new CorridorNode(
                    node.nodeId(),
                    point2x.x2(),
                    point2x.y2(),
                    node.roomId(),
                    node.roomRelativeCell(),
                    node.roomBoundaryDirection()));
        }
        return Corridor.resolved(corridor.corridorId(), layout.mapId(), corridor.levelZ(), updatedNodes, corridor.segments(), roomsById(layout));
    }

    public static Corridor withInsertedNode(DungeonLayout layout, Corridor corridor, Long segmentId, GridPoint2x point2x) {
        if (layout == null || corridor == null || segmentId == null || point2x == null) {
            return corridor;
        }
        CorridorSegment target = corridor.findSegment(segmentId);
        if (target == null) {
            return corridor;
        }
        long nodeId = nextSyntheticNodeId(corridor);
        long segmentStartId = nextSyntheticSegmentId(corridor);
        long segmentEndId = segmentStartId - 1;
        ArrayList<CorridorNode> nodes = new ArrayList<>(corridor.nodes());
        nodes.add(new CorridorNode(nodeId, point2x.x2(), point2x.y2(), null, null, null));
        ArrayList<CorridorSegment> segments = new ArrayList<>();
        for (CorridorSegment segment : corridor.segments()) {
            if (!Objects.equals(segment.segmentId(), segmentId)) {
                segments.add(segment);
                continue;
            }
            segments.add(new CorridorSegment(segmentStartId, segment.startNodeId(), nodeId));
            segments.add(new CorridorSegment(segmentEndId, nodeId, segment.endNodeId()));
        }
        return Corridor.resolved(corridor.corridorId(), layout.mapId(), corridor.levelZ(), nodes, segments, roomsById(layout));
    }

    public static Corridor withDeletedNode(DungeonLayout layout, Corridor corridor, Long nodeId) {
        if (layout == null || corridor == null || nodeId == null) {
            return corridor;
        }
        CorridorNode removed = corridor.findNode(nodeId);
        if (removed == null || removed.isRoomBound()) {
            return corridor;
        }
        List<CorridorSegment> touching = corridor.segmentsForNode(nodeId);
        if (touching.isEmpty() || touching.size() > 2) {
            return corridor;
        }
        ArrayList<CorridorNode> nodes = new ArrayList<>();
        for (CorridorNode node : corridor.nodes()) {
            if (node != null && !nodeId.equals(node.nodeId())) {
                nodes.add(node);
            }
        }
        ArrayList<CorridorSegment> segments = new ArrayList<>();
        for (CorridorSegment segment : corridor.segments()) {
            if (segment == null || nodeId.equals(segment.startNodeId()) || nodeId.equals(segment.endNodeId())) {
                continue;
            }
            segments.add(segment);
        }
        if (touching.size() == 2) {
            Long firstNeighbor = touching.getFirst().startNodeId().equals(nodeId) ? touching.getFirst().endNodeId() : touching.getFirst().startNodeId();
            Long secondNeighbor = touching.getLast().startNodeId().equals(nodeId) ? touching.getLast().endNodeId() : touching.getLast().startNodeId();
            segments.add(new CorridorSegment(nextSyntheticSegmentId(corridor), firstNeighbor, secondNeighbor));
        }
        return Corridor.resolved(corridor.corridorId(), layout.mapId(), corridor.levelZ(), nodes, segments, roomsById(layout));
    }

    public static Corridor withBranch(
            DungeonLayout layout,
            Corridor corridor,
            Long attachNodeId,
            List<CorridorNode> branchNodes,
            List<CorridorSegment> branchSegments
    ) {
        if (layout == null || corridor == null || attachNodeId == null || branchNodes == null || branchSegments == null) {
            return corridor;
        }
        if (corridor.findNode(attachNodeId) == null) {
            return corridor;
        }
        ArrayList<CorridorNode> nodes = new ArrayList<>(corridor.nodes());
        for (CorridorNode node : branchNodes) {
            if (node != null) {
                nodes.add(node);
            }
        }
        ArrayList<CorridorSegment> segments = new ArrayList<>(corridor.segments());
        for (CorridorSegment segment : branchSegments) {
            if (segment != null) {
                segments.add(segment);
            }
        }
        return Corridor.resolved(corridor.corridorId(), layout.mapId(), corridor.levelZ(), nodes, segments, roomsById(layout));
    }

    public static Map<Long, Room> roomsById(DungeonLayout layout) {
        Map<Long, Room> roomsById = new LinkedHashMap<>();
        if (layout == null) {
            return Map.of();
        }
        for (Room room : layout.rooms()) {
            if (room != null && room.roomId() != null) {
                roomsById.put(room.roomId(), room);
            }
        }
        return roomsById.isEmpty() ? Map.of() : Map.copyOf(roomsById);
    }

    public static long nextSyntheticNodeId(Corridor corridor) {
        long min = -1L;
        if (corridor != null) {
            for (CorridorNode node : corridor.nodes()) {
                if (node != null && node.nodeId() != null) {
                    min = Math.min(min, node.nodeId());
                }
            }
        }
        return min <= 0 ? min - 1 : -1L;
    }

    public static long nextSyntheticSegmentId(Corridor corridor) {
        long min = -1L;
        if (corridor != null) {
            for (CorridorSegment segment : corridor.segments()) {
                if (segment != null && segment.segmentId() != null) {
                    min = Math.min(min, segment.segmentId());
                }
            }
        }
        return min <= 0 ? min - 1 : -1L;
    }
}
