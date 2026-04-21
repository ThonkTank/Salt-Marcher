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
