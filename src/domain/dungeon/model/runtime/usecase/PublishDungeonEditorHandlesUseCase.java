package src.domain.dungeon.model.runtime.usecase;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.StairExit;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorAffordanceModel;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleProjection;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleProjectionKind;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.room.DungeonClusterBoundary;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

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
            Map<Long, DungeonRoom> primaryRoomsByCluster
    ) {
        Set<DoorBoundaryRef> publishedDoorRefs = new java.util.LinkedHashSet<>();
        for (Corridor corridor : dungeonMap.corridors()) {
            for (int index = 0; index < corridor.stateBindings().doorBindings().size(); index++) {
                var binding = corridor.stateBindings().doorBindings().get(index);
                DungeonRoomCluster cluster = cluster(dungeonMap, binding.clusterId());
                Cell roomCell = binding.relativeCell();
                Cell absoluteRoomCell = cluster == null
                        ? roomCell
                        : new Cell(
                                cluster.center().q() + roomCell.q(),
                                cluster.center().r() + roomCell.r(),
                                roomCell.level());
                Cell corridorCell = binding.direction().neighborOf(absoluteRoomCell);
                Edge doorEdge = binding.direction().edgeOf(absoluteRoomCell);
                result.add(new DungeonEditorHandleProjection(
                        DungeonEditorHandleProjectionKind.DOOR,
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
                        doorEdge));
                publishedDoorRefs.add(new DoorBoundaryRef(
                        binding.topologyRef(),
                        binding.clusterId(),
                        binding.relativeCell(),
                        binding.direction()));
            }
        }
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            appendStandaloneDoorHandles(
                    result,
                    cluster,
                    primaryRoomsByCluster.get(cluster.clusterId()),
                    publishedDoorRefs);
        }
    }

    private static void appendStandaloneDoorHandles(
            List<DungeonEditorHandleProjection> result,
            DungeonRoomCluster cluster,
            @Nullable DungeonRoom room,
            Set<DoorBoundaryRef> publishedDoorRefs
    ) {
        if (cluster == null) {
            return;
        }
        List<DungeonClusterBoundary> boundaries = cluster.orderedAuthoredBoundaries();
        int doorIndex = 0;
        for (DungeonClusterBoundary boundary : boundaries) {
            if (boundary == null || !boundary.isDoor()) {
                continue;
            }
            DungeonTopologyRef topologyRef = boundary.resolvedTopologyRef(cluster.center());
            DoorBoundaryRef boundaryRef = new DoorBoundaryRef(
                    topologyRef,
                    cluster.clusterId(),
                    boundary.relativeCell(),
                    boundary.direction());
            if (!publishedDoorRefs.add(boundaryRef)) {
                continue;
            }
            Cell absoluteRoomCell = new Cell(
                    cluster.center().q() + boundary.relativeCell().q(),
                    cluster.center().r() + boundary.relativeCell().r(),
                    boundary.relativeCell().level());
            Edge doorEdge = boundary.direction().edgeOf(absoluteRoomCell);
            Cell handleCell = boundary.direction().neighborOf(absoluteRoomCell);
            result.add(new DungeonEditorHandleProjection(
                    DungeonEditorHandleProjectionKind.DOOR,
                    topologyRef,
                    topologyRef.present() ? topologyRef.id() : 0L,
                    cluster.clusterId(),
                    0L,
                    room == null ? 0L : room.roomId(),
                    doorIndex,
                    handleCell,
                    midpoint(doorEdge.from().q(), doorEdge.to().q()),
                    midpoint(doorEdge.from().r(), doorEdge.to().r()),
                    boundary.direction(),
                    "Tür " + (topologyRef.present() ? topologyRef.id() : (doorIndex + 1)),
                    doorEdge));
            doorIndex++;
        }
    }

    private static double midpoint(int first, int second) {
        return (first + second) / 2.0;
    }

    private static void appendWaypointHandles(List<DungeonEditorHandleProjection> result, DungeonMap dungeonMap) {
        for (Corridor corridor : dungeonMap.corridors()) {
            for (int index = 0; index < corridor.stateBindings().waypoints().size(); index++) {
                var waypoint = corridor.stateBindings().waypoints().get(index);
                DungeonRoomCluster cluster = cluster(dungeonMap, waypoint.clusterId());
                Cell absolute = cluster == null
                        ? waypoint.relativeCell()
                        : waypoint.absoluteCell(cluster.center());
                result.add(new DungeonEditorHandleProjection(
                        DungeonEditorHandleProjectionKind.CORRIDOR_WAYPOINT,
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
                        null));
            }
        }
    }

    private static void appendAnchorHandles(List<DungeonEditorHandleProjection> result, DungeonMap dungeonMap) {
        for (Corridor corridor : dungeonMap.corridors()) {
            for (int index = 0; index < corridor.stateBindings().anchorBindings().size(); index++) {
                var anchor = corridor.stateBindings().anchorBindings().get(index);
                Cell anchorCell = anchor.absoluteCell();
                result.add(new DungeonEditorHandleProjection(
                        DungeonEditorHandleProjectionKind.CORRIDOR_ANCHOR,
                        anchor.topologyRef(),
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
                        null));
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
                DungeonEditorHandleProjectionKind.STAIR_ANCHOR,
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
                null);
    }

    private static @Nullable DungeonRoomCluster cluster(DungeonMap dungeonMap, long clusterId) {
        for (DungeonRoomCluster candidate : dungeonMap.topology().roomClusters()) {
            if (candidate.clusterId() == clusterId) {
                return candidate;
            }
        }
        return null;
    }

    private static Map<Long, DungeonRoom> primaryRoomsByCluster(DungeonMap dungeonMap) {
        Map<Long, DungeonRoom> result = new LinkedHashMap<>();
        for (DungeonRoom room : dungeonMap.rooms().rooms()) {
            if (room == null) {
                continue;
            }
            DungeonRoom existing = result.get(room.clusterId());
            if (existing == null || room.roomId() < existing.roomId()) {
                result.put(room.clusterId(), room);
            }
        }
        return Map.copyOf(result);
    }

    private record DoorBoundaryRef(
            DungeonTopologyRef topologyRef,
            long clusterId,
            Cell relativeCell,
            Direction direction
    ) {
    }
}
