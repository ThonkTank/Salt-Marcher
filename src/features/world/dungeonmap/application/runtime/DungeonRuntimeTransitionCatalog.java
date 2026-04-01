package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
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

    public static List<DungeonRuntimeTransitionDescriptor> describe(DungeonLayout layout, Room room, CubePoint activeTile) {
        if (layout == null || room == null || room.roomId() == null) {
            return List.of();
        }
        return levelsForRoomSurface(room.geometry(), activeTile).stream()
                .flatMap(levelZ -> describe(layout, room.geometry().cellsAtLevel(levelZ), levelZ).stream())
                .toList();
    }

    public static List<DungeonRuntimeTransitionDescriptor> describe(DungeonLayout layout, Corridor corridor, CubePoint activeTile) {
        if (layout == null || corridor == null || corridor.corridorId() == null) {
            return List.of();
        }
        return describe(layout, corridor.geometry().cellsAtLevel(corridor.levelZ()), corridor.levelZ());
    }

    public static List<DungeonRuntimeTransitionDescriptor> describeAtTile(DungeonLayout layout, CubePoint tile) {
        if (layout == null || tile == null) {
            return List.of();
        }
        return layout.transitionsAtPoint(tile).stream()
                .filter(transition -> transition != null && transition.transitionId() != null)
                .sorted(Comparator.comparing(DungeonTransition::transitionId))
                .map(transition -> new DungeonRuntimeTransitionDescriptor(
                        transition.transitionId(),
                        transition.label(),
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
                .sorted(Comparator.comparing(DungeonTransition::transitionId))
                .map(transition -> new DungeonRuntimeTransitionDescriptor(
                        transition.transitionId(),
                        transition.label(),
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
        if (transition.description() != null && !transition.description().isBlank()) {
            return transition.description();
        }
        if (transition.destination() instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            return transition.label() + " führt zum Overworld-Feld " + overworld.tileId() + ".";
        }
        if (transition.destination() instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            if (dungeon.transitionId() == null) {
                return transition.label() + " führt zu Dungeon " + dungeon.mapId() + ".";
            }
            return transition.label() + " führt zu Übergang " + dungeon.transitionId() + " auf Dungeon " + dungeon.mapId() + ".";
        }
        return transition.label();
    }

    private static List<Integer> levelsForRoomSurface(features.world.dungeonmap.model.objects.StructureGeometry geometry, CubePoint activeTile) {
        if (geometry == null) {
            return List.of();
        }
        if (activeTile != null && geometry.contains(activeTile)) {
            return List.of(activeTile.z());
        }
        return geometry.levels().stream()
                .sorted()
                .toList();
    }
}
