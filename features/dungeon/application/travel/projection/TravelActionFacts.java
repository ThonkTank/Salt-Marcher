package features.dungeon.application.travel.projection;

import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonTravelActionId;

public record TravelActionFacts(
        DungeonTravelActionId actionId,
        TravelActionKind kind,
        String label,
        String destinationLabel,
        String description,
        @Nullable TravelPositionFacts targetPosition,
        TravelTransitionTarget transitionTarget
) {
    public TravelActionFacts {
        kind = kind == null ? TravelActionKind.defaultKind() : kind;
        actionId = java.util.Objects.requireNonNull(actionId, "actionId");
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        destinationLabel = cleanText(destinationLabel);
        description = cleanText(description);
        transitionTarget = transitionTarget == null ? TravelTransitionTarget.absent() : transitionTarget;
    }

    public String displayLabel() {
        return destinationLabel.isBlank() ? label : label + ": " + destinationLabel;
    }

    private static String cleanText(String value) {
        return value == null ? "" : value.trim();
    }
}
