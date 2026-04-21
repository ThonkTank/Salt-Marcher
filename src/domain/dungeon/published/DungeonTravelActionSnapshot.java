package src.domain.dungeon.published;

public record DungeonTravelActionSnapshot(
        String actionId,
        DungeonTravelActionKind kind,
        String label,
        String destinationLabel,
        String description
) {

    public DungeonTravelActionSnapshot {
        actionId = actionId == null ? "" : actionId.trim();
        kind = kind == null ? DungeonTravelActionKind.STAIR : kind;
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        description = description == null ? "" : description.trim();
    }

    public String displayLabel() {
        return destinationLabel.isBlank() ? label : label + ": " + destinationLabel;
    }
}
