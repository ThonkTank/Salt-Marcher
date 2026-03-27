package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.corridor.planning.CorridorPlan;
import features.world.dungeonmap.model.structures.corridor.planning.ResolvedCorridorPlanner;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.traversal.CorridorTraversalSlice;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.TraversalRoomAnchor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class TraversalGeometryRealizer {

    private TraversalGeometryRealizer() {
        throw new AssertionError("No instances");
    }

    public static TraversalPlan realize(TraversalStructurePlanner.StructurePlan structurePlan) {
        TraversalStructurePlanner.StructurePlan resolvedPlan = structurePlan == null
                ? TraversalStructurePlanner.StructurePlan.empty()
                : structurePlan;
        TraversalTopology topology = resolvedPlan.topology();
        List<TraversalTopology.RoomPortal> participatingPortals = participatingPortals(resolvedPlan);
        List<Room> rooms = materializeRooms(participatingPortals, topology.mapId());
        Map<Long, Point2i> anchorCellsByRoomId = indexAnchorCells(participatingPortals);
        List<CubePoint> waypointCells = waypointCells(resolvedPlan.guideNodes());
        Map<Long, ResolvedCorridorDoorBinding> doorBindings = indexDoorBindings(participatingPortals);
        CorridorPlan corridorPlan = ResolvedCorridorPlanner.planResolved(
                topology.corridorId(),
                topology.mapId(),
                rooms,
                anchorCellsByRoomId,
                waypointCells,
                doorBindings,
                topology.obstacles());
        CorridorTraversalSlice slice = new CorridorTraversalSlice(
                topology.corridorId(),
                corridorPlan.path(),
                corridorPlan.connections());
        return new TraversalPlan(List.of(slice), corridorPlan.stairPlacements());
    }

    private static List<TraversalTopology.RoomPortal> participatingPortals(TraversalStructurePlanner.StructurePlan structurePlan) {
        TraversalTopology topology = structurePlan == null ? TraversalTopology.empty() : structurePlan.topology();
        if (topology.roomPortals().isEmpty()) {
            return List.of();
        }
        if (structurePlan == null || structurePlan.attachedPortalIndices().isEmpty()) {
            return topology.roomPortals();
        }
        ArrayList<TraversalTopology.RoomPortal> result = new ArrayList<>();
        for (Integer index : structurePlan.attachedPortalIndices()) {
            if (index == null || index < 0 || index >= topology.roomPortals().size()) {
                continue;
            }
            TraversalTopology.RoomPortal roomPortal = topology.roomPortals().get(index);
            if (roomPortal != null) {
                result.add(roomPortal);
            }
        }
        return result.isEmpty() ? topology.roomPortals() : List.copyOf(result);
    }

    private static List<Room> materializeRooms(List<TraversalTopology.RoomPortal> roomPortals, long mapId) {
        if (roomPortals == null || roomPortals.isEmpty()) {
            return List.of();
        }
        ArrayList<Room> result = new ArrayList<>();
        for (TraversalTopology.RoomPortal roomPortal : roomPortals) {
            if (roomPortal == null || roomPortal.roomAnchor() == null) {
                continue;
            }
            TraversalRoomAnchor roomAnchor = roomPortal.roomAnchor();
            result.add(Room.create(
                    roomAnchor.roomId(),
                    mapId,
                    roomAnchor.clusterId() == null ? 0L : roomAnchor.clusterId(),
                    "Raum " + (roomAnchor.roomId() == null ? "neu" : roomAnchor.roomId()),
                    floorsByLevel(roomAnchor)));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Map<Long, Point2i> indexAnchorCells(List<TraversalTopology.RoomPortal> roomPortals) {
        if (roomPortals == null || roomPortals.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<Long, Point2i> result = new LinkedHashMap<>();
        for (TraversalTopology.RoomPortal roomPortal : roomPortals) {
            if (roomPortal != null && roomPortal.roomId() != null && roomPortal.guideCell() != null) {
                result.put(roomPortal.roomId(), roomPortal.guideCell());
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static List<CubePoint> waypointCells(List<TraversalStructurePlanner.GuideNode> guideNodes) {
        if (guideNodes == null || guideNodes.isEmpty()) {
            return List.of();
        }
        ArrayList<CubePoint> result = new ArrayList<>();
        for (TraversalStructurePlanner.GuideNode guideNode : guideNodes) {
            if (guideNode == null
                    || guideNode.kind() != TraversalStructurePlanner.GuideNodeKind.WAYPOINT
                    || guideNode.guideCell() == null) {
                continue;
            }
            result.add(CubePoint.at(guideNode.guideCell(), guideNode.levelZ() == null ? 0 : guideNode.levelZ()));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Map<Long, ResolvedCorridorDoorBinding> indexDoorBindings(List<TraversalTopology.RoomPortal> roomPortals) {
        if (roomPortals == null || roomPortals.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<Long, ResolvedCorridorDoorBinding> result = new LinkedHashMap<>();
        for (TraversalTopology.RoomPortal roomPortal : roomPortals) {
            if (roomPortal == null || roomPortal.roomId() == null || !roomPortal.hasFixedDoorBinding()) {
                continue;
            }
            result.put(roomPortal.roomId(), roomPortal.fixedDoorBinding());
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Integer, Floor> floorsByLevel(TraversalRoomAnchor roomAnchor) {
        LinkedHashMap<Integer, Set<Point2i>> cellsByLevel = new LinkedHashMap<>();
        for (CubePoint occupiedCell : roomAnchor.occupiedCells()) {
            cellsByLevel.computeIfAbsent(occupiedCell.z(), ignored -> new LinkedHashSet<>())
                    .add(occupiedCell.projectedCell());
        }
        LinkedHashMap<Integer, Floor> result = new LinkedHashMap<>();
        Set<Integer> levels = roomAnchor.levels().isEmpty()
                ? Set.of(roomAnchor.primaryLevel())
                : roomAnchor.levels();
        for (Integer level : levels) {
            if (level == null) {
                continue;
            }
            Set<Point2i> cells = cellsByLevel.get(level);
            Floor floor = cells == null || cells.isEmpty()
                    ? new Floor(null)
                    : new Floor(TileShape.fromAbsoluteCells(roomAnchor.anchorCell(), cells));
            result.put(level, floor);
        }
        return result.isEmpty() ? Map.of(roomAnchor.primaryLevel(), new Floor(null)) : Map.copyOf(result);
    }
}
