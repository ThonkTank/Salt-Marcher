package features.world.dungeonmap.application.runtime;

public record DungeonRuntimeTransitionDescriptor(
        long transitionId,
        String transitionLabel,
        String destinationLabel,
        String description
) {

    public DungeonRuntimeTransitionDescriptor {
        transitionLabel = transitionLabel == null || transitionLabel.isBlank() ? "Übergang" : transitionLabel.trim();
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        description = description == null ? "" : description.trim();
    }

    public String displayLabel() {
        return destinationLabel.isBlank() ? transitionLabel : transitionLabel + ": " + destinationLabel;
    }
}
