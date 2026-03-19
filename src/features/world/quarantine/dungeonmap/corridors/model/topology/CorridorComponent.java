package features.world.quarantine.dungeonmap.corridors.model.topology;

import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomGeometry;
import features.world.quarantine.dungeonmap.rooms.model.RoomShape;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record CorridorComponent(
        String componentId,
        long mapId,
        Set<Long> corridorIds,
        Set<Long> roomIds,
        Set<Point2i> cells,
        List<Point2i> outlineVertices,
        List<DoorSegment> doors
) {
    public static List<CorridorComponent> fromGeometries(long mapId, Map<String, List<CorridorGeometry>> groupedGeometries) {
        List<CorridorComponent> result = new ArrayList<>();
        for (Map.Entry<String, List<CorridorGeometry>> entry : groupedGeometries.entrySet()) {
            String componentId = entry.getKey();
            List<CorridorGeometry> geometries = entry.getValue();
            Set<Long> corridorIds = new LinkedHashSet<>();
            Set<Long> roomIds = new LinkedHashSet<>();
            Set<Point2i> cells = new LinkedHashSet<>();
            List<DoorSegment> doors = new ArrayList<>();
            for (CorridorGeometry g : geometries) {
                if (g.corridorId() != null) corridorIds.add(g.corridorId());
                roomIds.addAll(g.roomIds());
                cells.addAll(g.cells());
                doors.addAll(g.doors());
            }
            RoomShape shape = cells.isEmpty() ? null : DungeonRoomGeometry.roomShapeForCells(cells);
            List<Point2i> outlineVertices = shape == null ? List.of() : shape.absoluteVertices();
            result.add(new CorridorComponent(
                    componentId,
                    mapId,
                    Set.copyOf(corridorIds),
                    Set.copyOf(roomIds),
                    Set.copyOf(cells),
                    List.copyOf(outlineVertices),
                    List.copyOf(doors)));
        }
        return List.copyOf(result);
    }
}
