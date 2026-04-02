package features.world.dungeonmap.application.runtime;

public record DungeonRuntimeStairDescriptor(
        String stairLabel,
        String exitLabel,
        String destinationLabel,
        String description,
        DungeonRuntimeLocation targetLocation
) implements DungeonRuntimeAction {
    public DungeonRuntimeStairDescriptor {
        stairLabel = stairLabel == null || stairLabel.isBlank() ? "Treppe" : stairLabel.trim();
        exitLabel = exitLabel == null || exitLabel.isBlank() ? "Ausgang" : exitLabel.trim();
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        description = description == null ? "" : description.trim();
    }

    public String displayLabel() {
        if (destinationLabel.isBlank()) {
            return stairLabel + ": " + exitLabel;
        }
        return stairLabel + ": " + destinationLabel;
    }
}
