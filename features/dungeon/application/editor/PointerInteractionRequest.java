package features.dungeon.application.editor;

public record PointerInteractionRequest(
        PointerAction action,
        String selectedTool,
        PointerWorkflowGesture gesture,
        PointerInteractionTargets targets,
        int projectionLevel,
        TransitionDestination transitionDestination
) {
    public PointerInteractionRequest {
        selectedTool = safeText(selectedTool);
        gesture = gesture == null ? PointerWorkflowGesture.empty() : gesture;
        targets = targets == null ? PointerInteractionTargets.empty() : targets;
        transitionDestination = transitionDestination == null
                ? TransitionDestination.empty()
                : transitionDestination;
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }
}
