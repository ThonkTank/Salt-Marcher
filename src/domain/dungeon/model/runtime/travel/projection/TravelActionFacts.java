package src.domain.dungeon.model.runtime.travel.projection;

import org.jspecify.annotations.Nullable;

public record TravelActionFacts(
        String actionId,
        TravelActionKind kind,
        String label,
        String destinationLabel,
        String description,
        @Nullable TravelPositionFacts targetPosition,
        TravelTransitionTarget transitionTarget
) {

    public TravelActionFacts {
        kind = kind == null ? TravelActionKind.defaultKind() : kind;
        actionId = cleanText(actionId);
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
