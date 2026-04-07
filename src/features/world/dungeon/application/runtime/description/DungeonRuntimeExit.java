package features.world.dungeon.application.runtime.description;

import features.world.dungeon.dungoenmap.structure.model.boundary.door.DoorRef;

import java.util.Objects;

public record DungeonRuntimeExit(
        String label,
        int number,
        DoorRef doorRef,
        String destinationLabel,
        String description
) {
    public DungeonRuntimeExit {
        label = label == null ? "" : label.trim();
        number = number <= 0 ? 1 : number;
        doorRef = Objects.requireNonNull(doorRef, "doorRef");
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        description = description == null ? "" : description.trim();
    }
}
