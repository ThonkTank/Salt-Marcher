package features.world.quarantine.dungeonmap.corridors.model.topology;

import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.routing.CorridorRoutePlanner;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class CorridorTopologyPlanner {

    private CorridorTopologyPlanner() {
        throw new AssertionError("No instances");
    }

    public static CorridorTopology planCorridorTopology(DungeonLayout layout) {
        return planCorridorTopology(layout, buildLayoutContext(layout));
    }

    public static CorridorTopology planCorridorTopology(DungeonLayout layout, CorridorLayoutContext context) {
        if (layout == null) {
            return new CorridorTopology(Map.of(), Map.of(), Map.of());
        }
        CorridorLayoutContext resolvedContext = context == null ? buildLayoutContext(layout) : context;

        Map<Long, CorridorGeometry> result = new LinkedHashMap<>();
        for (DungeonCorridor corridor : layout.corridors()) {
            List<DungeonRoom> corridorRooms = resolveCorridorRooms(corridor, resolvedContext);
            result.put(corridor.corridorId(), safePlanCorridorGeometry(
                    layout,
                    corridor,
                    corridorRooms,
                    resolvedContext.roomCellsById(),
                    resolvedContext.roomOccupancy()));
        }
        return CorridorTopologyBuilder.build(layout, result);
    }

    public static CorridorLayoutContext buildLayoutContext(DungeonLayout layout) {
        return CorridorLayoutContext.from(layout);
    }

    public static CorridorGeometry planCorridorGeometry(DungeonLayout layout, DungeonCorridor corridor) {
        return planCorridorGeometry(layout, corridor, buildLayoutContext(layout));
    }

    public static CorridorGeometry planCorridorGeometry(DungeonLayout layout, DungeonCorridor corridor, CorridorLayoutContext context) {
        if (layout == null || corridor == null || context == null) {
            return null;
        }
        List<DungeonRoom> corridorRooms = resolveCorridorRooms(corridor, context);
        return safePlanCorridorGeometry(layout, corridor, corridorRooms, context.roomCellsById(), context.roomOccupancy());
    }

    private static List<DungeonRoom> resolveCorridorRooms(DungeonCorridor corridor, CorridorLayoutContext context) {
        return corridor.roomIds().stream()
                .map(context.roomsById()::get)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private static CorridorGeometry safePlanCorridorGeometry(
            DungeonLayout layout,
            DungeonCorridor corridor,
            List<DungeonRoom> corridorRooms,
            Map<Long, Set<Point2i>> roomCellsById,
            Map<Point2i, Long> roomOccupancy
    ) {
        try {
            return CorridorRoutePlanner.planCorridorGeometry(layout, corridor, corridorRooms, roomCellsById, roomOccupancy);
        } catch (RuntimeException exception) {
            // Alte/inkonsistente Korridordaten sollen den gesamten Dungeon-Load nicht blockieren.
            return CorridorGeometry.empty(
                    corridor == null ? null : corridor.corridorId(),
                    corridor == null ? List.of() : corridor.roomIds());
        }
    }
}
