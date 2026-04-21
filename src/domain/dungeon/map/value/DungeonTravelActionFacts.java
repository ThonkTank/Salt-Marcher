package src.domain.dungeon.map.value;

import org.jspecify.annotations.Nullable;

public record DungeonTravelActionFacts(
        String actionId,
        DungeonTravelActionKind kind,
        String label,
        String destinationLabel,
        String description,
        @Nullable DungeonTravelPositionFacts targetPosition,
        @Nullable DungeonTransitionDestination transitionDestination
) {

    public DungeonTravelActionFacts {
        kind = kind == null ? DungeonTravelActionKind.STAIR : kind;
        NormalizedAction normalized = normalize(actionId, label, destinationLabel, description, kind);
        actionId = normalized.actionId();
        label = normalized.label();
        destinationLabel = normalized.destinationLabel();
        description = normalized.description();
    }

    public String displayLabel() {
        return destinationLabel.isBlank() ? label : label + ": " + destinationLabel;
    }

    private static NormalizedAction normalize(
            String actionId,
            String label,
            String destinationLabel,
            String description,
            DungeonTravelActionKind kind
    ) {
        return new NormalizedAction(
                actionId == null ? "" : actionId.trim(),
                label == null || label.isBlank() ? kind.name() : label.trim(),
                destinationLabel == null ? "" : destinationLabel.trim(),
                description == null ? "" : description.trim());
    }

    private record NormalizedAction(
            String actionId,
            String label,
            String destinationLabel,
            String description
    ) {
    }
}
