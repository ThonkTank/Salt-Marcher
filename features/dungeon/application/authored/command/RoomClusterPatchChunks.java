package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.DungeonClusterBoundary;
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
        return Set.copyOf(result);
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
        for (DungeonClusterBoundary boundary : cluster.orderedAuthoredBoundaries()) {
            addChunk(mapChunks, map, boundary.absoluteCell(cluster.center()));
        }
        if (mapChunks.isEmpty()) {
            addChunk(mapChunks, map, cluster.center());
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
