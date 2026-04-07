package features.world.dungeon.dungoenmap.corridor.model;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.dungoenmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungoenmap.structure.model.boundary.door.DoorRef;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
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
        Map<GridSegment, BoundaryAttachmentInput> attachableBoundariesBySegment,
        Set<GridSegment> occupiedConnectionSegments,
        List<Door> corridorDoors
) {
    public CorridorResolutionInput {
        blockedCells = blockedCells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(blockedCells));
        exteriorDoorsByRef = exteriorDoorsByRef == null ? Map.of() : Map.copyOf(new LinkedHashMap<>(exteriorDoorsByRef));
        attachableBoundariesBySegment = attachableBoundariesBySegment == null
                ? Map.of()
                : Map.copyOf(new LinkedHashMap<>(attachableBoundariesBySegment));
        occupiedConnectionSegments = occupiedConnectionSegments == null
                ? Set.of()
                : Set.copyOf(new LinkedHashSet<>(occupiedConnectionSegments));
        corridorDoors = corridorDoors == null ? List.of() : List.copyOf(corridorDoors);
    }

    public CorridorResolutionInput withDoors(Collection<Door> doors) {
        return new CorridorResolutionInput(
                levelZ,
                blockedCells,
                exteriorDoorsByRef,
                attachableBoundariesBySegment,
                occupiedConnectionSegments,
                doors == null ? List.of() : List.copyOf(doors));
    }

    public ExteriorDoorInput requiredExteriorDoor(DoorRef doorRef) {
        ExteriorDoorInput description = doorRef == null ? null : exteriorDoorsByRef.get(doorRef);
        if (description == null || description.roomId() == null) {
            throw new IllegalArgumentException("Corridor door node must reference an existing exterior room door");
        }
        return description;
    }

    public BoundaryAttachmentInput requiredBoundaryAttachment(GridSegment boundarySegment) {
        BoundaryAttachmentInput attachment = boundarySegment == null ? null : attachableBoundariesBySegment.get(boundarySegment);
        if (attachment == null) {
            throw new IllegalArgumentException("Corridor attachment target must be a free corridor wall");
        }
        return attachment;
    }

    public boolean hasOccupiedConnection(GridSegment boundarySegment) {
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

    public record BoundaryAttachmentInput(
            Long corridorId,
            GridSegment boundarySegment,
            GridPoint corridorCell
    ) {
        public BoundaryAttachmentInput {
            boundarySegment = Objects.requireNonNull(boundarySegment, "boundarySegment");
            corridorCell = Objects.requireNonNull(corridorCell, "corridorCell");
        }
    }
}
