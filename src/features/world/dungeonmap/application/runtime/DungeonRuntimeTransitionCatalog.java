package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

public final class DungeonRuntimeTransitionCatalog {

    private DungeonRuntimeTransitionCatalog() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonRuntimeTransitionDescriptor> describe(DungeonLayout layout, Room room) {
        if (layout == null || room == null || room.roomId() == null) {
            return List.of();
        }
        return describe(layout, room.cells(), layout.levelForRoom(room.roomId()));
    }

    public static List<DungeonRuntimeTransitionDescriptor> describe(DungeonLayout layout, Corridor corridor) {
        if (layout == null || corridor == null || corridor.corridorId() == null || corridor.path() == null) {
            return List.of();
        }
        return describe(layout, corridor.path().floor().shape().absoluteCells(), layout.levelForCorridor(corridor.corridorId()));
    }

    public static List<DungeonRuntimeTransitionDescriptor> describe(DungeonLayout layout, CorridorNetwork network) {
        if (layout == null || network == null || network.floor() == null) {
            return List.of();
        }
        // All corridors in a network share the same z-level.
        Integer levelZ = network.corridorIds().stream()
                .filter(id -> id != null)
                .map(layout::levelForCorridor)
                .findFirst()
                .orElse(null);
        return levelZ == null ? List.of() : describe(layout, network.floor().shape().absoluteCells(), levelZ);
    }

    public static List<DungeonRuntimeTransitionDescriptor> describeAtTile(DungeonLayout layout, CubePoint tile) {
        if (layout == null || tile == null) {
            return List.of();
        }
        return layout.transitionsAtPoint(tile).stream()
                .filter(transition -> transition != null && transition.transitionId() != null)
                .sorted(Comparator.comparing(DungeonTransition::name, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(DungeonTransition::transitionId))
                .map(transition -> new DungeonRuntimeTransitionDescriptor(
                        transition.transitionId(),
                        transition.name(),
                        destinationLabel(layout, transition.destination()),
                        description(layout, transition)))
                .toList();
    }

    private static List<DungeonRuntimeTransitionDescriptor> describe(DungeonLayout layout, Set<Point2i> cells, int levelZ) {
        if (layout == null || cells == null || cells.isEmpty()) {
            return List.of();
        }
        return layout.transitionsAtLevel(levelZ).stream()
                .filter(transition -> transition.anchor() != null && cells.contains(transition.anchor().projectedCell()))
                .sorted(Comparator.comparing(DungeonTransition::name, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(DungeonTransition::transitionId))
                .map(transition -> new DungeonRuntimeTransitionDescriptor(
                        transition.transitionId(),
                        transition.name(),
                        destinationLabel(layout, transition.destination()),
                        description(layout, transition)))
                .toList();
    }

    private static String destinationLabel(DungeonLayout layout, DungeonTransitionDestination destination) {
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            return "Overworld-Feld " + overworld.tileId();
        }
        if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            if (dungeon.transitionId() == null) {
                return "Dungeon " + dungeon.mapId();
            }
            return "Dungeon " + dungeon.mapId() + " · Übergang " + dungeon.transitionId();
        }
        return "";
    }

    private static String description(DungeonLayout layout, DungeonTransition transition) {
        if (transition == null) {
            return "";
        }
        if (transition.destination() instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            return transition.name() + " führt zum Overworld-Feld " + overworld.tileId() + ".";
        }
        if (transition.destination() instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            if (dungeon.transitionId() == null) {
                return transition.name() + " führt zu Dungeon " + dungeon.mapId() + ".";
            }
            return transition.name() + " führt zu Übergang " + dungeon.transitionId() + " auf Dungeon " + dungeon.mapId() + ".";
        }
        return transition.name();
    }
}
