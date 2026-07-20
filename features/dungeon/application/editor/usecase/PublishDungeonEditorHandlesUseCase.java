package features.dungeon.application.editor.usecase;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.component.StairExit;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.application.editor.interaction.DungeonEditorAffordanceModel;
import features.dungeon.application.editor.interaction.DungeonEditorHandleProjection;
import features.dungeon.api.DungeonEditorHandleKind;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;

/**
 * Publishes authored editor handles from one dungeon map snapshot.
 */
public final class PublishDungeonEditorHandlesUseCase {
    private static final DungeonEditorAffordanceModel AFFORDANCE_MODEL =
            new DungeonEditorAffordanceModel();

    public List<DungeonEditorHandleProjection> execute(@Nullable DungeonMap dungeonMap) {
        if (dungeonMap == null) {
            return List.of();
        }
        List<DungeonEditorHandleProjection> result = new ArrayList<>();
        result.addAll(AFFORDANCE_MODEL.clusterAffordances(dungeonMap));
        appendDoorHandles(result, dungeonMap, primaryRoomsByCluster(dungeonMap));
        appendAnchorHandles(result, dungeonMap);
        appendWaypointHandles(result, dungeonMap);
        appendStairHandles(result, dungeonMap);
        return List.copyOf(result);
    }

    private static void appendDoorHandles(
            List<DungeonEditorHandleProjection> result,
            DungeonMap dungeonMap,
            Map<Long, RoomRegion> primaryRoomsByCluster
    ) {
        Set<DoorBoundaryRef> publishedDoorRefs = new java.util.LinkedHashSet<>();
        for (Corridor corridor : dungeonMap.corridors()) {
            for (int index = 0; index < corridor.bindings().doorBindings().size(); index++) {
                var binding = corridor.bindings().doorBindings().get(index);
                Cell roomCell = binding.roomCell();
                Cell corridorCell = binding.direction().neighborOf(roomCell);
                Edge doorEdge = binding.direction().edgeOf(roomCell);
                result.add(new DungeonEditorHandleProjection(
                        DungeonEditorHandleKind.DOOR,
                        binding.topologyRef(),
                        binding.topologyRef().present() ? binding.topologyRef().id() : corridor.corridorId(),
                        binding.clusterId(),
                        corridor.corridorId(),
                        binding.roomId(),
                        index,
                        corridorCell,
                        midpoint(doorEdge.from().q(), doorEdge.to().q()),
                        midpoint(doorEdge.from().r(), doorEdge.to().r()),
                        binding.direction(),
                        "Tür " + corridor.corridorId() + "." + (index + 1),
                        doorEdge,
                        List.of(doorEdge)));
                publishedDoorRefs.add(new DoorBoundaryRef(
                        binding.topologyRef(),
                        binding.clusterId(),
                        EdgeKey.from(doorEdge)));
            }
        }
        for (RoomCluster cluster : dungeonMap.topology().roomClusters()) {
            appendStandaloneDoorHandles(
                    result,
                    cluster,
                    primaryRoomsByCluster.get(cluster.clusterId()),
                    publishedDoorRefs);
        }
    }

    private static void appendStandaloneDoorHandles(
            List<DungeonEditorHandleProjection> result,
            RoomCluster cluster,
            @Nullable RoomRegion room,
            Set<DoorBoundaryRef> publishedDoorRefs
    ) {
        if (cluster == null) {
            return;
        }
        List<BoundarySegment> boundaries = cluster.orderedAuthoredBoundaries();
        int doorIndex = 0;
        for (BoundarySegment boundary : boundaries) {
            if (boundary == null || !boundary.isDoor()) {
                continue;
            }
            DungeonTopologyRef topologyRef = boundary.resolvedTopologyRef();
            Edge doorEdge = boundary.edge();
            DoorBoundaryRef boundaryRef = new DoorBoundaryRef(
                    topologyRef,
                    cluster.clusterId(),
                    EdgeKey.from(doorEdge));
            if (!publishedDoorRefs.add(boundaryRef)) {
                continue;
            }
            DoorSide doorSide = doorSide(doorEdge, room);
            result.add(new DungeonEditorHandleProjection(
                    DungeonEditorHandleKind.DOOR,
                    topologyRef,
                    topologyRef.present() ? topologyRef.id() : 0L,
                    cluster.clusterId(),
                    0L,
                    room == null ? 0L : room.roomId(),
                    doorIndex,
                    doorSide.handleCell(),
                    midpoint(doorEdge.from().q(), doorEdge.to().q()),
                    midpoint(doorEdge.from().r(), doorEdge.to().r()),
                    doorSide.direction(),
                    "Tür " + (topologyRef.present() ? topologyRef.id() : (doorIndex + 1)),
                    doorEdge,
                    List.of(doorEdge)));
            doorIndex++;
        }
    }

    private static double midpoint(int first, int second) {
        return (first + second) / 2.0;
    }

    private static DoorSide doorSide(Edge edge, @Nullable RoomRegion room) {
        List<Cell> touchingCells = edge.touchingCells();
        if (room != null) {
            for (Cell cell : touchingCells) {
                if (room.floorCells().contains(cell)) {
                    Direction direction = directionFor(cell, edge);
                    if (direction != null) {
                        return new DoorSide(direction.neighborOf(cell), direction);
                    }
                }
            }
        }
        for (Cell cell : touchingCells) {
            Direction direction = directionFor(cell, edge);
            if (direction != null) {
                return new DoorSide(direction.neighborOf(cell), direction);
            }
        }
        return new DoorSide(edge.from(), Direction.NORTH);
    }

    private static @Nullable Direction directionFor(Cell cell, Edge edge) {
        EdgeKey edgeKey = EdgeKey.from(edge);
        for (Direction direction : Direction.values()) {
            if (EdgeKey.from(direction.edgeOf(cell)).equals(edgeKey)) {
                return direction;
            }
        }
        return null;
    }

    private static void appendWaypointHandles(List<DungeonEditorHandleProjection> result, DungeonMap dungeonMap) {
        for (Corridor corridor : dungeonMap.corridors()) {
            for (int index = 0; index < corridor.bindings().waypoints().size(); index++) {
                var waypoint = corridor.bindings().waypoints().get(index);
                Cell absolute = waypoint.cell();
                result.add(new DungeonEditorHandleProjection(
                        DungeonEditorHandleKind.CORRIDOR_WAYPOINT,
                        new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR, corridor.corridorId()),
                        corridor.corridorId(),
                        waypoint.clusterId(),
                        corridor.corridorId(),
                        0L,
                        index,
                        absolute,
                        absolute.q(),
                        absolute.r(),
                        Direction.NORTH,
                        "Wegpunkt " + (index + 1),
                        null,
                        List.of()));
            }
        }
    }

    private static void appendAnchorHandles(List<DungeonEditorHandleProjection> result, DungeonMap dungeonMap) {
        for (Corridor corridor : dungeonMap.corridors()) {
            for (int index = 0; index < corridor.bindings().anchorBindings().size(); index++) {
                var anchor = corridor.bindings().anchorBindings().get(index);
                Cell anchorCell = anchor.position();
                result.add(new DungeonEditorHandleProjection(
                        DungeonEditorHandleKind.CORRIDOR_ANCHOR,
                        dungeonMap.topologyIndex().corridorAnchorRef(anchor.hostCorridorId(), anchor.anchorId()),
                        anchor.anchorId(),
                        0L,
                        corridor.corridorId(),
                        0L,
                        index,
                        anchorCell,
                        anchorCell.q(),
                        anchorCell.r(),
                        Direction.NORTH,
                        "Korridoranker " + (index + 1),
                        null,
                        List.of()));
            }
        }
    }

    private static void appendStairHandles(List<DungeonEditorHandleProjection> result, DungeonMap dungeonMap) {
        for (Stair stair : dungeonMap.stairs().stairs()) {
            List<Cell> path = stair.path();
            List<StairExit> exits = stair.exits();
            for (int index = 0; index < path.size(); index++) {
                result.add(stairHandle(stair, path.get(index), index, "Treppenanker " + (index + 1)));
            }
            int offset = path.size();
            for (int index = 0; index < exits.size(); index++) {
                StairExit exit = exits.get(index);
                result.add(stairHandle(stair, exit.position(), offset + index, exit.label()));
            }
        }
    }

    private static DungeonEditorHandleProjection stairHandle(Stair stair, Cell cell, int index, String label) {
        return new DungeonEditorHandleProjection(
                DungeonEditorHandleKind.STAIR_ANCHOR,
                new DungeonTopologyRef(DungeonTopologyElementKind.STAIR, stair.stairId()),
                stair.stairId(),
                0L,
                stair.corridorId() == null ? 0L : stair.corridorId(),
                0L,
                index,
                cell,
                cell.q(),
                cell.r(),
                stair.direction(),
                label,
                null,
                List.of());
    }

    private static Map<Long, RoomRegion> primaryRoomsByCluster(DungeonMap dungeonMap) {
        Map<Long, RoomRegion> result = new LinkedHashMap<>();
        for (RoomRegion room : dungeonMap.rooms().rooms()) {
            if (room == null) {
                continue;
            }
            RoomRegion existing = result.get(room.clusterId());
            if (existing == null || room.roomId() < existing.roomId()) {
                result.put(room.clusterId(), room);
            }
        }
        return Map.copyOf(result);
    }

    private record DoorBoundaryRef(
            DungeonTopologyRef topologyRef,
            long clusterId,
            EdgeKey edgeKey
    ) {
    }

    private record DoorSide(
            Cell handleCell,
            Direction direction
    ) {
    }
}
