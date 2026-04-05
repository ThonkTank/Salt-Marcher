package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.Stair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

import java.util.Objects;

/**
 * Shared parsed runtime location for description writing and action assembly.
 *
 * <p>Resolve the active structure once, then fan out into the read-only description branch and the executable
 * action branch instead of reparsing layout ownership at each sink.
 */
public record DungeonRuntimeLocation(
        DungeonLayout layout,
        DungeonRuntimeNavigationSnapshot navigation,
        CellCoord activeCell,
        int activeLevelZ,
        CardinalDirection heading,
        DungeonLayout.CellStructure structure,
        DungeonSelectionRef ownerRef
) {
    public DungeonRuntimeLocation {
        layout = Objects.requireNonNull(layout, "layout");
        navigation = Objects.requireNonNull(navigation, "navigation");
        activeCell = Objects.requireNonNull(activeCell, "activeCell");
        heading = heading == null ? CardinalDirection.defaultDirection() : heading;
        structure = Objects.requireNonNull(structure, "structure");
        ownerRef = Objects.requireNonNull(ownerRef, "ownerRef");
    }

    public static DungeonRuntimeLocation resolve(
            DungeonLayout layout,
            DungeonRuntimeNavigationSnapshot navigation
    ) {
        if (layout == null || navigation == null || navigation.isEmpty() || navigation.cell() == null) {
            return null;
        }
        DungeonLayout.CellStructure structure = layout.structureAtCell(navigation.cell(), navigation.levelZ());
        DungeonSelectionRef ownerRef = ownerRef(structure);
        if (structure == null || ownerRef == null) {
            return null;
        }
        return new DungeonRuntimeLocation(
                layout,
                navigation,
                navigation.cell(),
                navigation.levelZ(),
                navigation.heading(),
                structure,
                ownerRef);
    }

    public Room room() {
        return structure instanceof DungeonLayout.CellStructure.RoomStructure roomStructure
                ? roomStructure.room()
                : null;
    }

    public Corridor corridor() {
        return structure instanceof DungeonLayout.CellStructure.CorridorStructure corridorStructure
                ? corridorStructure.corridor()
                : null;
    }

    public Stair stair() {
        return structure instanceof DungeonLayout.CellStructure.StairStructure stairStructure
                ? stairStructure.stair()
                : null;
    }

    public DungeonTransition transition() {
        return structure instanceof DungeonLayout.CellStructure.TransitionStructure transitionStructure
                ? transitionStructure.transition()
                : null;
    }

    private static DungeonSelectionRef ownerRef(DungeonLayout.CellStructure structure) {
        if (structure instanceof DungeonLayout.CellStructure.RoomStructure roomStructure) {
            Long roomId = roomStructure.room() == null ? null : roomStructure.room().roomId();
            return roomId == null ? null : new DungeonSelectionRef.RoomRef(roomId);
        }
        if (structure instanceof DungeonLayout.CellStructure.CorridorStructure corridorStructure) {
            Long corridorId = corridorStructure.corridor() == null ? null : corridorStructure.corridor().corridorId();
            return corridorId == null ? null : new DungeonSelectionRef.CorridorRef(corridorId);
        }
        if (structure instanceof DungeonLayout.CellStructure.StairStructure stairStructure) {
            Long stairId = stairStructure.stair() == null ? null : stairStructure.stair().stairId();
            return stairId == null ? null : new DungeonSelectionRef.StairRef(stairId);
        }
        if (structure instanceof DungeonLayout.CellStructure.TransitionStructure transitionStructure) {
            Long transitionId = transitionStructure.transition() == null ? null : transitionStructure.transition().transitionId();
            return transitionId == null ? null : new DungeonSelectionRef.TransitionRef(transitionId);
        }
        return null;
    }
}
