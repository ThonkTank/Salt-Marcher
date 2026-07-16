package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.room.RoomTopologyRebuilder.RebuildResult;
import features.dungeon.domain.core.structure.room.RoomTopologyWorkCatalog.IdAllocation;
import features.dungeon.domain.core.structure.topology.SpatialTopology;

final class RoomPartitionPreservingDelete {

    private final RoomTopologyRebuilder rebuilder;
    private final RoomPartitionedWorkBuilder workBuilder;

    RoomPartitionPreservingDelete(RoomTopologyRebuilder rebuilder, RoomPartitionedWorkBuilder workBuilder) {
        this.rebuilder = rebuilder;
        this.workBuilder = workBuilder;
    }

    Optional<RebuildResult> deleteRectangle(
            SpatialTopology topology,
            List<DungeonRoomTopologyClusterWork> clusters,
            Cell start,
            Cell end,
            IdAllocation allocation
    ) {
        Set<Cell> deletedCells = RoomClusterCells.rectangle(start, end);
        if (deletedCells.isEmpty()) {
            return Optional.empty();
        }
        RoomMutationIdCursor ids = new RoomMutationIdCursor(allocation);
        List<DungeonRoomTopologyClusterWork> nextClusters = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : RoomMutationWorkSets.safeClusters(clusters)) {
            if (!RoomMutationWorkSets.intersects(RoomMutationCellMaps.cellsAt(work, start.level()), deletedCells)) {
                nextClusters.add(work);
                continue;
            }
            nextClusters.addAll(afterDeletingLevelCells(work, start.level(), deletedCells, ids));
        }
        return Optional.of(rebuilder.rebuiltPreservingRooms(topology, nextClusters));
    }

    private List<DungeonRoomTopologyClusterWork> afterDeletingLevelCells(
            DungeonRoomTopologyClusterWork work,
            int level,
            Set<Cell> deletedCells,
            RoomMutationIdCursor ids
    ) {
        Set<Cell> remainingAtLevel = new LinkedHashSet<>(RoomMutationCellMaps.cellsAt(work, level));
        remainingAtLevel.removeAll(deletedCells);
        List<Set<Cell>> components = RoomClusterCells.connectedComponents(remainingAtLevel);
        Map<Integer, List<Cell>> otherLevels = new LinkedHashMap<>(work.cellsByLevel());
        otherLevels.remove(level);
        if (components.isEmpty() && RoomMutationCellMaps.allLevelsEmpty(otherLevels)) {
            return List.of();
        }
        if (components.isEmpty()) {
            return List.of(workBuilder.partitionedWork(
                    work,
                    otherLevels,
                    workBuilder.preservedBoundariesFor(work.cluster(), List.of(work), otherLevels),
                    ids,
                    RoomMutationRoomCoverage.previousCellsByRoom(List.of(work))));
        }
        return splitLevelComponents(work, level, components, otherLevels, ids);
    }

    private List<DungeonRoomTopologyClusterWork> splitLevelComponents(
            DungeonRoomTopologyClusterWork work,
            int level,
            List<Set<Cell>> components,
            Map<Integer, List<Cell>> otherLevels,
            RoomMutationIdCursor ids
    ) {
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        Map<Long, List<Cell>> previousCellsByRoom = RoomMutationRoomCoverage.previousCellsByRoom(List.of(work));
        Set<Long> claimedRoomIds = new LinkedHashSet<>();
        boolean first = true;
        for (Set<Cell> component : components) {
            Map<Integer, List<Cell>> componentCells = componentCells(level, component, first, otherLevels);
            DungeonRoomTopologyClusterWork componentWork = first
                    ? work
                    : RoomMutationClusterCreation.newClusterShell(
                            ids.reserveClusterId(),
                            work.cluster().mapId(),
                            componentCells,
                            work.rooms());
            result.add(partitionedComponent(componentWork, work, componentCells, ids, previousCellsByRoom, claimedRoomIds));
            claimedRoomIds.addAll(RoomMutationRoomCoverage.roomIds(result.getLast().rooms()));
            first = false;
        }
        return List.copyOf(result);
    }

    private DungeonRoomTopologyClusterWork partitionedComponent(
            DungeonRoomTopologyClusterWork componentWork,
            DungeonRoomTopologyClusterWork sourceWork,
            Map<Integer, List<Cell>> componentCells,
            RoomMutationIdCursor ids,
            Map<Long, List<Cell>> previousCellsByRoom,
            Set<Long> claimedRoomIds
    ) {
        return workBuilder.partitionedWork(
                workBuilder.rehomedWork(componentWork, componentCells, List.of(sourceWork), claimedRoomIds),
                componentCells,
                workBuilder.preservedBoundariesFor(componentWork.cluster(), List.of(sourceWork), componentCells),
                ids,
                previousCellsByRoom);
    }

    private static Map<Integer, List<Cell>> componentCells(
            int level,
            Set<Cell> component,
            boolean includeOtherLevels,
            Map<Integer, List<Cell>> otherLevels
    ) {
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        if (includeOtherLevels) {
            result.putAll(otherLevels);
        }
        result.put(level, RoomClusterCells.sortedCells(component));
        return Map.copyOf(result);
    }
}
