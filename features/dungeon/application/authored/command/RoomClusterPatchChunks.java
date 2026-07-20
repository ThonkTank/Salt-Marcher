package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomRegion;
import java.util.LinkedHashSet;
import java.util.Set;

/** Derives the chunk closure occupied by one room cluster before and after a patch. */
final class RoomClusterPatchChunks {
    private RoomClusterPatchChunks() {
    }

    static Set<DungeonChunkKey> touchedChunks(DungeonMap before, DungeonMap after, long clusterId) {
        Set<DungeonChunkKey> result = new LinkedHashSet<>();
        addMapChunks(result, before, clusterId);
        addMapChunks(result, after, clusterId);
        addDependentCorridorChunks(result, before, after, clusterId);
        return Set.copyOf(result);
    }

    private static void addDependentCorridorChunks(
            Set<DungeonChunkKey> result,
            DungeonMap before,
            DungeonMap after,
            long clusterId
    ) {
        Set<Long> corridorIds = new LinkedHashSet<>();
        addDependentCorridorIds(corridorIds, before, clusterId);
        addDependentCorridorIds(corridorIds, after, clusterId);
        for (long corridorId : corridorIds) {
            result.addAll(CorridorPatchChunks.touchedChunks(before, after, corridorId));
        }
    }

    private static void addDependentCorridorIds(Set<Long> result, DungeonMap map, long clusterId) {
        if (map == null) {
            return;
        }
        Set<Long> roomIds = new LinkedHashSet<>();
        for (RoomRegion room : map.rooms().roomsInCluster(clusterId)) {
            roomIds.add(room.roomId());
        }
        for (Corridor corridor : map.corridors()) {
            if (referencesCluster(corridor, clusterId, roomIds)) {
                result.add(corridor.corridorId());
            }
        }
    }

    private static boolean referencesCluster(Corridor corridor, long clusterId, Set<Long> roomIds) {
        return corridor.roomIds().stream().anyMatch(roomIds::contains)
                || corridor.bindings().doorBindings().stream()
                        .anyMatch(binding -> binding.clusterId() == clusterId)
                || corridor.bindings().waypoints().stream()
                        .anyMatch(waypoint -> waypoint.clusterId() == clusterId);
    }

    private static void addMapChunks(Set<DungeonChunkKey> result, DungeonMap map, long clusterId) {
        if (map == null) {
            return;
        }
        Set<DungeonChunkKey> mapChunks = new LinkedHashSet<>();
        for (RoomRegion room : map.rooms().roomsInCluster(clusterId)) {
            for (Cell cell : room.floorCells()) {
                addChunk(mapChunks, map, cell);
            }
        }
        RoomCluster cluster = map.topology().roomCluster(clusterId);
        if (cluster == null) {
            result.addAll(mapChunks);
            return;
        }
        for (BoundarySegment boundary : cluster.orderedAuthoredBoundaries()) {
            boundary.edge().touchingCells().forEach(cell -> addChunk(mapChunks, map, cell));
        }
        result.addAll(mapChunks);
    }

    private static void addChunk(Set<DungeonChunkKey> result, DungeonMap map, Cell cell) {
        result.add(new DungeonChunkKey(
                map.metadata().mapId().value(),
                cell.level(),
                Math.floorDiv(cell.q(), DungeonChunkKey.CHUNK_SIZE),
                Math.floorDiv(cell.r(), DungeonChunkKey.CHUNK_SIZE)));
    }
}
