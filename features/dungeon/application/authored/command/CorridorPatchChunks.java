package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.projection.DungeonAreaType;
import features.dungeon.domain.core.projection.DungeonDerivedStateProjection;
import features.dungeon.domain.core.projection.DungeonState;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.room.RoomCluster;
import java.util.LinkedHashSet;
import java.util.Set;

/** Derives the chunk closure occupied by one corridor before and after a patch. */
final class CorridorPatchChunks {
    private static final DungeonDerivedStateProjection PROJECTION = new DungeonDerivedStateProjection();

    private CorridorPatchChunks() {
    }

    static Set<DungeonChunkKey> touchedChunks(DungeonMap before, DungeonMap after, long corridorId) {
        Set<DungeonChunkKey> result = new LinkedHashSet<>();
        addMapChunks(result, before, corridorId);
        addMapChunks(result, after, corridorId);
        return Set.copyOf(result);
    }

    private static void addMapChunks(Set<DungeonChunkKey> result, DungeonMap map, long corridorId) {
        if (map == null) {
            return;
        }
        int initialSize = result.size();
        for (DungeonState aggregate : PROJECTION.project(map).aggregates()) {
            if (aggregate.kind() == DungeonAreaType.CORRIDOR && aggregate.id() == corridorId) {
                for (Cell cell : aggregate.cells()) {
                    addChunk(result, map, cell);
                }
            }
        }
        if (result.size() != initialSize) {
            return;
        }
        Corridor corridor = corridor(map, corridorId);
        if (corridor == null) {
            return;
        }
        for (CorridorWaypoint waypoint : corridor.bindings().waypoints()) {
            RoomCluster cluster = map.topology().roomCluster(waypoint.clusterId());
            addChunk(result, map, waypoint.absoluteCell(cluster == null
                    ? new Cell(0, 0, waypoint.level())
                    : cluster.center()));
        }
        corridor.bindings().anchorBindings().forEach(anchor -> addChunk(result, map, anchor.position()));
        for (CorridorDoorBinding door : corridor.bindings().doorBindings()) {
            RoomCluster cluster = map.topology().roomCluster(door.clusterId());
            Cell center = cluster == null ? new Cell(0, 0, door.relativeCell().level()) : cluster.center();
            Cell roomCell = new Cell(
                    center.q() + door.relativeCell().q(),
                    center.r() + door.relativeCell().r(),
                    door.relativeCell().level());
            addChunk(result, map, roomCell);
            addChunk(result, map, door.direction().neighborOf(roomCell));
        }
    }

    private static Corridor corridor(DungeonMap map, long corridorId) {
        for (Corridor corridor : map.corridors()) {
            if (corridor.corridorId() == corridorId) {
                return corridor;
            }
        }
        return null;
    }

    private static void addChunk(Set<DungeonChunkKey> result, DungeonMap map, Cell cell) {
        result.add(new DungeonChunkKey(
                map.metadata().mapId().value(),
                cell.level(),
                Math.floorDiv(cell.q(), DungeonChunkKey.CHUNK_SIZE),
                Math.floorDiv(cell.r(), DungeonChunkKey.CHUNK_SIZE)));
    }
}
