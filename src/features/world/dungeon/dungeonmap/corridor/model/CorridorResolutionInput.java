package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Frozen corridor-external context materialized by the map owner.
 */
public record CorridorResolutionInput(
        int levelZ,
        GridArea blockedArea,
        Map<DoorRef, ExteriorDoorInput> exteriorDoorsByRef,
        GridBoundary occupiedConnectionBoundary
) {
    public CorridorResolutionInput {
        blockedArea = blockedArea == null ? GridArea.empty() : blockedArea.onLevel(levelZ);
        exteriorDoorsByRef = exteriorDoorsByRef == null ? Map.of() : Map.copyOf(new LinkedHashMap<>(exteriorDoorsByRef));
        occupiedConnectionBoundary = occupiedConnectionBoundary == null
                ? GridBoundary.empty()
                : occupiedConnectionBoundary;
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
        return boundarySegment != null && occupiedConnectionBoundary.contains(boundarySegment);
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
