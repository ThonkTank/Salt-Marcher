package features.world.dungeon.dungoenmap.corridor.model;

import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.dungoenmap.structure.model.boundary.door.DoorRef;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Fixed before/after room-binding context for map-orchestrated corridor reconciliation.
 */
public record CorridorReconcileInput(
        Set<Long> affectedRoomIds,
        Map<DoorRef, CorridorResolutionInput.ExteriorDoorInput> originalDoorsByRef,
        Map<DoorRef, CorridorResolutionInput.ExteriorDoorInput> updatedDoorsByRef,
        GridTranslation translation,
        CorridorResolutionInput updatedResolution
) {
    public CorridorReconcileInput {
        affectedRoomIds = affectedRoomIds == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(affectedRoomIds));
        originalDoorsByRef = originalDoorsByRef == null ? Map.of() : Map.copyOf(new LinkedHashMap<>(originalDoorsByRef));
        updatedDoorsByRef = updatedDoorsByRef == null ? Map.of() : Map.copyOf(new LinkedHashMap<>(updatedDoorsByRef));
    }

    public boolean hasAffectedRooms() {
        return !affectedRoomIds.isEmpty();
    }
}
