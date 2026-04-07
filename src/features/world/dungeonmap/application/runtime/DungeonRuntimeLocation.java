package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.geometry.CardinalDirection;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.cluster.model.RoomCluster;
import features.world.dungeonmap.corridor.model.Corridor;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
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
        GridPoint activeCell,
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
        if (!(structure instanceof DungeonLayout.CellStructure.RoomStructure roomStructure)) {
            return null;
        }
        RoomCluster cluster = roomStructure.clusterId() == null ? null : layout.findCluster(roomStructure.clusterId());
        return cluster == null ? null : cluster.structure().roomTopology().findRoom(roomStructure.roomId());
    }

    public Corridor corridor() {
        return structure instanceof DungeonLayout.CellStructure.CorridorStructure corridorStructure
                ? corridorStructure.corridor()
                : null;
    }

    public DungeonStair stair() {
        return structure instanceof DungeonLayout.CellStructure.StairStructure stairStructure
                ? stairStructure.stair()
                : null;
    }

    public DungeonTransition transition() {
        return structure instanceof DungeonLayout.CellStructure.TransitionStructure transitionStructure
                ? transitionStructure.transition()
                : null;
    }

    public ConnectionEndpoint activeEndpoint() {
        if (ownerRef instanceof DungeonSelectionRef.RoomRef roomRef) {
            return roomRef.roomId() == null ? null : ConnectionEndpoint.room(roomRef.roomId());
        }
        if (ownerRef instanceof DungeonSelectionRef.CorridorRef corridorRef) {
            return corridorRef.corridorId() == null ? null : ConnectionEndpoint.corridor(corridorRef.corridorId());
        }
        if (ownerRef instanceof DungeonSelectionRef.TransitionRef transitionRef) {
            return transitionRef.transitionId() == null ? null : ConnectionEndpoint.transition(transitionRef.transitionId());
        }
        return null;
    }

    private static DungeonSelectionRef ownerRef(DungeonLayout.CellStructure structure) {
        if (structure instanceof DungeonLayout.CellStructure.RoomStructure roomStructure) {
            Long roomId = roomStructure.roomId();
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
