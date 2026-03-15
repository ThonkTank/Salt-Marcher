package features.world.dungeonmap.ui.shared.render;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.service.DungeonGeometry;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonLayoutRenderData {

    private final DungeonLayout layout;
    private final Map<Long, DungeonRoom> roomsById;
    private final Map<Long, List<Point2i>> roomPolygons;
    private final Map<Long, Set<Point2i>> roomCells;
    private final Map<Long, List<Point2i>> corridorPaths;

    private DungeonLayoutRenderData(
            DungeonLayout layout,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, List<Point2i>> roomPolygons,
            Map<Long, Set<Point2i>> roomCells,
            Map<Long, List<Point2i>> corridorPaths
    ) {
        this.layout = layout;
        this.roomsById = roomsById;
        this.roomPolygons = roomPolygons;
        this.roomCells = roomCells;
        this.corridorPaths = corridorPaths;
    }

    public static DungeonLayoutRenderData from(DungeonLayout layout) {
        Map<Long, DungeonRoom> roomsById = new HashMap<>();
        Map<Long, List<Point2i>> roomPolygons = new HashMap<>();
        Map<Long, Set<Point2i>> roomCells = new HashMap<>();
        if (layout != null) {
            for (DungeonRoom room : layout.rooms()) {
                Long roomId = room.roomId();
                if (roomId == null) {
                    continue;
                }
                roomsById.put(roomId, room);
                roomPolygons.put(roomId, DungeonGeometry.absolutePolygon(room));
                roomCells.put(roomId, DungeonGeometry.roomCells(room));
            }
        }
        Map<Long, List<Point2i>> corridorPaths = layout == null ? Map.of() : DungeonGeometry.corridorPaths(layout);
        return new DungeonLayoutRenderData(layout, Map.copyOf(roomsById), Map.copyOf(roomPolygons), Map.copyOf(roomCells), Map.copyOf(corridorPaths));
    }

    public DungeonLayout layout() {
        return layout;
    }

    public DungeonRoom roomById(Long roomId) {
        return roomId == null ? null : roomsById.get(roomId);
    }

    public List<Point2i> roomPolygon(Long roomId) {
        return roomId == null ? null : roomPolygons.get(roomId);
    }

    public Set<Point2i> roomCells(Long roomId) {
        return roomId == null ? null : roomCells.get(roomId);
    }

    public List<Point2i> corridorPath(Long corridorId) {
        return corridorId == null ? null : corridorPaths.get(corridorId);
    }
}
