package src.domain.dungeon.model.runtime.usecase;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.StairExit;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleProjection;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleProjectionKind;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.runtime.helper.DungeonEditorClusterHandleProjectionHelper;

/**
 * Publishes authored editor handles from one dungeon map snapshot.
 */
public final class PublishDungeonEditorHandlesUseCase {
    private static final DungeonEditorClusterHandleProjectionHelper CLUSTER_HANDLE_HELPER =
            new DungeonEditorClusterHandleProjectionHelper();

    public List<DungeonEditorHandleProjection> execute(@Nullable DungeonMap dungeonMap) {
        if (dungeonMap == null) {
            return List.of();
        }
        List<DungeonEditorHandleProjection> result = new ArrayList<>();
        result.addAll(CLUSTER_HANDLE_HELPER.project(dungeonMap));
        appendDoorHandles(result, dungeonMap);
        appendAnchorHandles(result, dungeonMap);
        appendWaypointHandles(result, dungeonMap);
        appendStairHandles(result, dungeonMap);
        return List.copyOf(result);
    }

    private static void appendDoorHandles(List<DungeonEditorHandleProjection> result, DungeonMap dungeonMap) {
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
                result.add(new DungeonEditorHandleProjection(
                        DungeonEditorHandleProjectionKind.DOOR,
                        binding.topologyRef(),
                        binding.topologyRef().present() ? binding.topologyRef().id() : corridor.corridorId(),
                        binding.clusterId(),
                        corridor.corridorId(),
                        binding.roomId(),
                        index,
                        corridorCell,
                        binding.direction(),
                        "Tür " + corridor.corridorId() + "." + (index + 1)));
            }
        }
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
                        Direction.NORTH,
                        "Wegpunkt " + (index + 1)));
            }
        }
    }

    private static void appendAnchorHandles(List<DungeonEditorHandleProjection> result, DungeonMap dungeonMap) {
        for (Corridor corridor : dungeonMap.corridors()) {
            for (int index = 0; index < corridor.stateBindings().anchorBindings().size(); index++) {
                var anchor = corridor.stateBindings().anchorBindings().get(index);
                result.add(new DungeonEditorHandleProjection(
                        DungeonEditorHandleProjectionKind.CORRIDOR_ANCHOR,
                        anchor.topologyRef(),
                        anchor.anchorId(),
                        0L,
                        corridor.corridorId(),
                        0L,
                        index,
                        anchor.absoluteCell(),
                        Direction.NORTH,
                        "Korridoranker " + (index + 1)));
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
                stair.direction(),
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
