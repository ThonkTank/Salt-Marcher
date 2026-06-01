package src.domain.dungeon.model.worldspace.usecase;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.helper.DungeonEditorClusterHandleProjectionHelper;
import src.domain.dungeon.model.worldspace.model.DungeonMap;
import src.domain.dungeon.model.worldspace.model.DungeonCorridor;
import src.domain.dungeon.model.worldspace.model.DungeonRoomCluster;
import src.domain.dungeon.model.worldspace.model.DungeonStair;
import src.domain.dungeon.model.worldspace.model.DungeonCell;
import src.domain.dungeon.model.worldspace.model.DungeonEditorHandle;
import src.domain.dungeon.model.worldspace.model.DungeonEditorHandleFacts;
import src.domain.dungeon.model.worldspace.model.DungeonEditorHandleType;
import src.domain.dungeon.model.worldspace.model.DungeonEdgeDirection;
import src.domain.dungeon.model.worldspace.model.DungeonStairExit;
import src.domain.dungeon.model.worldspace.model.DungeonTopologyElementKind;
import src.domain.dungeon.model.worldspace.model.DungeonTopologyRef;

/**
 * Publishes authored editor handles from one dungeon map snapshot.
 */
public final class PublishDungeonEditorHandlesUseCase {
    private static final DungeonEditorClusterHandleProjectionHelper CLUSTER_HANDLE_HELPER =
            new DungeonEditorClusterHandleProjectionHelper();

    public List<DungeonEditorHandleFacts> execute(@Nullable DungeonMap dungeonMap) {
        if (dungeonMap == null) {
            return List.of();
        }
        List<DungeonEditorHandleFacts> result = new ArrayList<>();
        result.addAll(CLUSTER_HANDLE_HELPER.project(dungeonMap));
        appendDoorHandles(result, dungeonMap);
        appendAnchorHandles(result, dungeonMap);
        appendWaypointHandles(result, dungeonMap);
        appendStairHandles(result, dungeonMap);
        return List.copyOf(result);
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
        for (DungeonRoomCluster candidate : dungeonMap.topology().roomClusters()) {
            if (candidate.clusterId() == clusterId) {
                return candidate;
            }
        }
        return null;
    }
}
