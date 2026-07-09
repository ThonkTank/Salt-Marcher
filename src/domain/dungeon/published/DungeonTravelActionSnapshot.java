package src.domain.dungeon.published;

public record DungeonTravelActionSnapshot(
        DungeonTravelActionKind kind,
        String label,
        String destinationLabel,
        String description
) {

    public DungeonTravelActionSnapshot {
        kind = kind == null ? DungeonTravelActionKind.TRAVERSAL : kind;
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        description = description == null ? "" : description.trim();
    }

}
