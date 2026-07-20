package features.dungeon.api;

public record DungeonTravelActionSnapshot(
        DungeonTravelActionId actionId,
        DungeonTravelActionKind kind,
        String label,
        String destinationLabel,
        String description
) {

    public DungeonTravelActionSnapshot {
        actionId = java.util.Objects.requireNonNull(actionId, "actionId");
        kind = kind == null ? DungeonTravelActionKind.TRAVERSAL : kind;
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        description = description == null ? "" : description.trim();
    }

}
