package src.domain.dungeon.application;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.entity.DungeonStair;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonEditorHandle;
import src.domain.dungeon.map.value.DungeonEditorHandleFacts;
import src.domain.dungeon.map.value.DungeonEditorHandleType;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonStairExit;
import src.domain.dungeon.map.value.DungeonTopologyElementKind;
import src.domain.dungeon.map.value.DungeonTopologyRef;

/**
 * Publishes authored editor handles from one dungeon map snapshot.
 */
public final class PublishDungeonEditorHandlesUseCase {

    public List<DungeonEditorHandleFacts> execute(@Nullable DungeonMap dungeonMap) {
        if (dungeonMap == null) {
            return List.of();
        }
        List<DungeonEditorHandleFacts> result = new ArrayList<>();
        appendClusterLabelHandles(result, dungeonMap);
        appendDoorHandles(result, dungeonMap);
        appendAnchorHandles(result, dungeonMap);
        appendWaypointHandles(result, dungeonMap);
        appendStairHandles(result, dungeonMap);
        return List.copyOf(result);
    }

    private static void appendClusterLabelHandles(List<DungeonEditorHandleFacts> result, DungeonMap dungeonMap) {
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            List<DungeonRoom> rooms = dungeonMap.rooms().rooms().stream()
                    .filter(room -> room.clusterId() == cluster.clusterId())
                    .sorted(Comparator.comparingLong(DungeonRoom::roomId))
                    .toList();
            if (rooms.isEmpty()) {
                continue;
            }
            DungeonRoom room = rooms.getFirst();
            result.add(new DungeonEditorHandleFacts(
                    new DungeonEditorHandle(
                            DungeonEditorHandleType.CLUSTER_LABEL,
                            new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.roomId()),
                            room.roomId(),
                            cluster.clusterId(),
                            0L,
                            room.roomId(),
                            0,
                            cluster.center(),
                            DungeonEdgeDirection.NORTH),
                    room.name()));
        }
    }

    private static void appendDoorHandles(List<DungeonEditorHandleFacts> result, DungeonMap dungeonMap) {
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            for (int index = 0; index < corridor.bindings().doorBindings().size(); index++) {
                var binding = corridor.bindings().doorBindings().get(index);
                DungeonRoomCluster cluster = cluster(dungeonMap, binding.clusterId());
                DungeonCell roomCell = binding.relativeCell();
                DungeonCell absoluteRoomCell = cluster == null
                        ? roomCell
                        : new DungeonCell(
                                cluster.center().q() + roomCell.q(),
                                cluster.center().r() + roomCell.r(),
                                roomCell.level());
                DungeonCell corridorCell = binding.direction().neighborOf(absoluteRoomCell);
                result.add(new DungeonEditorHandleFacts(
                        new DungeonEditorHandle(
                                DungeonEditorHandleType.DOOR,
                                binding.topologyRef(),
                                binding.topologyRef().present() ? binding.topologyRef().id() : corridor.corridorId(),
                                binding.clusterId(),
                                corridor.corridorId(),
                                binding.roomId(),
                                index,
                                corridorCell,
                                binding.direction()),
                        "Tür " + corridor.corridorId() + "." + (index + 1)));
            }
        }
    }

    private static void appendWaypointHandles(List<DungeonEditorHandleFacts> result, DungeonMap dungeonMap) {
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            for (int index = 0; index < corridor.bindings().waypoints().size(); index++) {
                var waypoint = corridor.bindings().waypoints().get(index);
                DungeonRoomCluster cluster = cluster(dungeonMap, waypoint.clusterId());
                DungeonCell absolute = cluster == null
                        ? waypoint.relativeCell()
                        : waypoint.absoluteCell(cluster.center());
                result.add(new DungeonEditorHandleFacts(
                        new DungeonEditorHandle(
                                DungeonEditorHandleType.CORRIDOR_WAYPOINT,
                                new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR, corridor.corridorId()),
                                corridor.corridorId(),
                                waypoint.clusterId(),
                                corridor.corridorId(),
                                0L,
                                index,
                                absolute,
                                DungeonEdgeDirection.NORTH),
                        "Wegpunkt " + (index + 1)));
            }
        }
    }

    private static void appendAnchorHandles(List<DungeonEditorHandleFacts> result, DungeonMap dungeonMap) {
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            for (int index = 0; index < corridor.bindings().anchorBindings().size(); index++) {
                var anchor = corridor.bindings().anchorBindings().get(index);
                result.add(new DungeonEditorHandleFacts(
                        new DungeonEditorHandle(
                                DungeonEditorHandleType.CORRIDOR_ANCHOR,
                                anchor.topologyRef(),
                                anchor.anchorId(),
                                0L,
                                corridor.corridorId(),
                                0L,
                                index,
                                anchor.absoluteCell(),
                                DungeonEdgeDirection.NORTH),
                        "Korridoranker " + (index + 1)));
            }
        }
    }

    private static void appendStairHandles(List<DungeonEditorHandleFacts> result, DungeonMap dungeonMap) {
        for (DungeonStair stair : dungeonMap.connections().stairs()) {
            for (int index = 0; index < stair.path().size(); index++) {
                result.add(stairHandle(stair, stair.path().get(index), index, "Treppenanker " + (index + 1)));
            }
            int offset = stair.path().size();
            for (int index = 0; index < stair.exits().size(); index++) {
                DungeonStairExit exit = stair.exits().get(index);
                result.add(stairHandle(stair, exit.position(), offset + index, exit.label()));
            }
        }
    }

    private static DungeonEditorHandleFacts stairHandle(DungeonStair stair, DungeonCell cell, int index, String label) {
        return new DungeonEditorHandleFacts(
                new DungeonEditorHandle(
                        DungeonEditorHandleType.STAIR_ANCHOR,
                        new DungeonTopologyRef(DungeonTopologyElementKind.STAIR, stair.stairId()),
                        stair.stairId(),
                        0L,
                        stair.corridorId() == null ? 0L : stair.corridorId(),
                        0L,
                        index,
                        cell,
                        stair.direction()),
                label);
    }

    private static @Nullable DungeonRoomCluster cluster(DungeonMap dungeonMap, long clusterId) {
        return dungeonMap.topology().roomClusters().stream()
                .filter(candidate -> candidate.clusterId() == clusterId)
                .findFirst()
                .orElse(null);
    }
}
