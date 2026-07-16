package features.dungeon.application.travel.projection;

import java.util.List;
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

    public record SelectedAction(int rowIndex) {

        public SelectedAction {
            rowIndex = Math.max(-1, rowIndex);
        }

        public static SelectedAction invalid() {
            return new SelectedAction(-1);
        }

        public static SelectedAction atRow(int rowIndex) {
            return new SelectedAction(rowIndex);
        }

        public static SelectedAction safe(SelectedAction selectedAction) {
            return selectedAction == null ? invalid() : selectedAction;
        }

        public boolean isWithin(List<TravelActionFacts> actions) {
            return rowIndex >= 0 && actions != null && rowIndex < actions.size();
        }
    }
}
