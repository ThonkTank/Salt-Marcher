package src.features.dungeon.runtime;

import java.util.Objects;

final class DungeonEditorInteractionService implements DungeonEditorPointerInteractionOperations {
    private final DungeonEditorPointerOperationDispatcher operationDispatcher;
    private final DungeonEditorPointerSession pointerSession = new DungeonEditorPointerSession();

    DungeonEditorInteractionService(DungeonEditorAuthoredRuntimeOperations operationOwner) {
        operationDispatcher = new DungeonEditorPointerOperationDispatcher(
                Objects.requireNonNull(operationOwner, "operationOwner"));
    }

    @Override
    public PointerInteractionResult applyPointerInteraction(PointerInteractionRequest request) {
        PointerInteractionRequest safeRequest = request == null
                ? emptyRequest()
                : request;
        PointerWorkflowIntent intent = pointerWorkflowIntent(safeRequest.selectedTool(), safeRequest.gesture());
        if (!intent.workflowAccepted()) {
            clearPointerSession();
            return PointerInteractionResult.ignored();
        }
        PointerInteractionTargets targets = safeRequest.targets();
        DungeonEditorRuntimePointerTarget primaryTarget = targets.primaryTarget(intent.boundaryTargetsPreferred());
        PointerInteractionDecision decision = pointerInteractionDecision(
                safeRequest.action(),
                intent,
                new PointerInteractionCandidates(primaryTarget));
        DungeonEditorRuntimePointerTarget hoverTarget = DungeonEditorPointerSamplePolicy.pointerTargetChoice(
                decision.hoverTargetChoice(),
                targets,
                primaryTarget,
                DungeonEditorRuntimePointerTarget.empty(),
                safeRequest.projectionLevel());
        DungeonEditorRuntimePointerTarget sampleTarget = DungeonEditorPointerSamplePolicy.pointerTargetChoice(
                decision.sampleTargetChoice(),
                targets,
                primaryTarget,
                hoverTarget,
                safeRequest.projectionLevel());
        PointerSample sample = DungeonEditorPointerSamplePolicy.pointerSample(targets, sampleTarget, intent);
        boolean accepted = acceptPointerSession(
                safeRequest.action(),
                intent.effectiveToolKey(),
                sample,
                safeRequest.projectionLevel());
        boolean dispatched = accepted && safeRequest.action() != null;
        if (dispatched) {
            operationDispatcher.applyPointer(
                    safeRequest.action(),
                    intent.effectiveToolKey(),
                    sample,
                    intent.wallSingleClickMode(),
                    safeRequest.transitionDestination());
        }
        return new PointerInteractionResult(true, hoverTarget);
    }

    private PointerWorkflowIntent pointerWorkflowIntent(
            String selectedTool,
            PointerWorkflowGesture gesture
    ) {
        return DungeonEditorPointerWorkflowIntentResolver.resolve(selectedTool, gesture);
    }

    private PointerInteractionDecision pointerInteractionDecision(
            PointerAction action,
            PointerWorkflowIntent intent,
            PointerInteractionCandidates candidates
    ) {
        return DungeonEditorPointerWorkflowIntentResolver.resolveInteraction(action, intent, candidates);
    }

    private boolean acceptPointerSession(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            int projectionLevel
    ) {
        return pointerSession.accept(action, toolKey, sample, projectionLevel);
    }

    @Override
    public void clearPointerSession() {
        pointerSession.clear();
    }

    private static PointerInteractionRequest emptyRequest() {
        return new PointerInteractionRequest(
                null,
                "",
                PointerWorkflowGesture.empty(),
                PointerInteractionTargets.empty(),
                0,
                TransitionDestination.empty());
    }
}
