package src.features.dungeon.runtime;

import java.util.Objects;

final class DungeonEditorInteractionService implements DungeonEditorPointerInteractionOperations {
    private final DungeonEditorPointerOperationDispatcher operationDispatcher;
    private final DungeonEditorStore store;
    private final DungeonEditorRuntimeFramePublisher framePublisher;
    private final DungeonEditorPointerSession pointerSession = new DungeonEditorPointerSession();

    DungeonEditorInteractionService(
            DungeonEditorAuthoredRuntimeOperations operationOwner,
            DungeonEditorStore store,
            DungeonEditorRuntimeFramePublisher framePublisher
    ) {
        operationDispatcher = new DungeonEditorPointerOperationDispatcher(
                Objects.requireNonNull(operationOwner, "operationOwner"));
        this.store = Objects.requireNonNull(store, "store");
        this.framePublisher = Objects.requireNonNull(framePublisher, "framePublisher");
    }

    @Override
    public PointerInteractionResult applyPointerInteraction(PointerInteractionRequest request) {
        PointerInteractionRequest safeRequest = request == null
                ? emptyRequest()
                : request;
        PointerWorkflowIntent intent =
                DungeonEditorPointerWorkflowIntentResolver.resolve(safeRequest.selectedTool(), safeRequest.gesture());
        if (!intent.workflowAccepted()) {
            clearPointerSession();
            return PointerInteractionResult.ignored();
        }
        PointerInteractionTargets targets = safeRequest.targets();
        DungeonEditorRuntimePointerTarget primaryTarget = targets.primaryTarget(intent.boundaryTargetsPreferred());
        PointerInteractionDecision decision = DungeonEditorPointerWorkflowIntentResolver.resolveInteraction(
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
        boolean accepted = pointerSession.accept(
                safeRequest.action(),
                intent.effectiveTool(),
                sample,
                safeRequest.projectionLevel());
        boolean dispatched = accepted && safeRequest.action() != null;
        if (dispatched) {
            DungeonEditorRuntimeOperationPublisher.apply(
                    store,
                    framePublisher,
                    () -> operationDispatcher.applyPointer(
                            safeRequest.action(),
                            intent.effectiveTool(),
                            sample,
                            intent.wallSingleClickMode(),
                            safeRequest.transitionDestination()));
        }
        return new PointerInteractionResult(true, hoverTarget);
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
