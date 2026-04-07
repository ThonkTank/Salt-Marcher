package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Frozen corridor-external context materialized by the map owner.
 */
public record CorridorResolutionInput(
        int levelZ,
        Set<GridPoint> blockedCells,
        Map<DoorRef, ExteriorDoorInput> exteriorDoorsByRef,
        Set<GridSegment> occupiedConnectionSegments
) {
    public CorridorResolutionInput {
        blockedCells = blockedCells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(blockedCells));
        exteriorDoorsByRef = exteriorDoorsByRef == null ? Map.of() : Map.copyOf(new LinkedHashMap<>(exteriorDoorsByRef));
        occupiedConnectionSegments = occupiedConnectionSegments == null
                ? Set.of()
                : Set.copyOf(new LinkedHashSet<>(occupiedConnectionSegments));
        if (exteriorDoorsByRef.keySet().stream().anyMatch(Objects::isNull)
                || exteriorDoorsByRef.values().stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("Corridor exterior door inputs must stay complete");
        }
    }

    ExteriorDoorInput requiredExteriorDoor(DoorRef doorRef) {
        ExteriorDoorInput description = doorRef == null ? null : exteriorDoorsByRef.get(doorRef);
        if (description == null || description.roomId() == null) {
            throw new IllegalArgumentException("Corridor door node must reference an existing exterior room door");
        }
        return description;
    }

    boolean hasOccupiedConnection(GridSegment boundarySegment) {
        return boundarySegment != null && occupiedConnectionSegments.contains(boundarySegment);
    }

    public record ExteriorDoorInput(
            DoorRef ref,
            Door door,
            Long roomId,
            GridSegment anchorSegment,
            GridPoint roomCell,
            CardinalDirection outwardDirection
    ) {
        public ExteriorDoorInput {
            ref = Objects.requireNonNull(ref, "ref");
            door = Objects.requireNonNull(door, "door");
            anchorSegment = Objects.requireNonNull(anchorSegment, "anchorSegment");
            roomCell = Objects.requireNonNull(roomCell, "roomCell");
            outwardDirection = Objects.requireNonNull(outwardDirection, "outwardDirection");
        }

        public GridPoint anchorPoint() {
            return anchorSegment.midpoint();
        }

        public GridPoint exteriorCell() {
            return roomCell.step(outwardDirection);
        }
    }
}
