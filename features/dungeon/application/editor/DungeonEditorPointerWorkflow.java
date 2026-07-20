package features.dungeon.application.editor;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicLong;
import platform.execution.ExecutionLane;
import platform.execution.LatestWinsTaskQueue;
import features.dungeon.api.editor.DungeonEditorPointerGesture;
import features.dungeon.api.editor.DungeonEditorToolSelection;

final class DungeonEditorPointerWorkflow implements DungeonEditorPointerInteractionOperations {
    private final RuntimeFamilies runtimeFamilies;
    private final DungeonEditorRuntimeCommands commandPublisher;
    private final DungeonEditorPointerSession pointerSession = new DungeonEditorPointerSession();
    private final LatestWinsTaskQueue hoverQueue;
    private final AtomicLong interactionGeneration = new AtomicLong();

    DungeonEditorPointerWorkflow(
            RuntimeFamilies runtimeFamilies,
            DungeonEditorRuntimeCommands commandPublisher,
            ExecutionLane executionLane
    ) {
        this.runtimeFamilies = Objects.requireNonNull(runtimeFamilies, "runtimeFamilies");
        this.commandPublisher = Objects.requireNonNull(commandPublisher, "commandPublisher");
        hoverQueue = new LatestWinsTaskQueue(Objects.requireNonNull(executionLane, "executionLane"));
    }

    @Override
    public PointerInteractionResult applyPointerInteraction(PointerInteractionRequest request) {
        PointerInteractionRequest safeRequest = request == null
                ? emptyRequest()
                : request;
        PointerWorkflowIntent intent =
                DungeonEditorPointerWorkflowIntentResolver.resolve(safeRequest.toolSelection(), safeRequest.gesture());
        if (!intent.workflowAccepted()) {
            commandPublisher.execute(pointerSession::clear);
            return PointerInteractionResult.ignored();
        }
        PointerInteractionTargets targets = safeRequest.targets();
        features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget = targets.primaryTarget(intent.boundaryTargetsPreferred());
        PointerInteractionDecision decision = DungeonEditorPointerWorkflowIntentResolver.resolveInteraction(
                safeRequest.action(),
                intent,
                new PointerInteractionCandidates(primaryTarget));
        features.dungeon.api.editor.DungeonEditorPointerInput.Target hoverTarget = DungeonEditorPointerSamplePolicy.pointerTargetChoice(
                decision.hoverTargetChoice(),
                targets,
                primaryTarget,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty(),
                safeRequest.projectionLevel());
        features.dungeon.api.editor.DungeonEditorPointerInput.Target sampleTarget = DungeonEditorPointerSamplePolicy.pointerTargetChoice(
                decision.sampleTargetChoice(),
                targets,
                primaryTarget,
                hoverTarget,
                safeRequest.projectionLevel());
        PointerSample sample = DungeonEditorPointerSamplePolicy.pointerSample(targets, sampleTarget, intent);
        enqueuePointerSample(safeRequest, intent, sample);
        return new PointerInteractionResult(true, hoverTarget);
    }

    private void enqueuePointerSample(
            PointerInteractionRequest request,
            PointerWorkflowIntent intent,
            PointerSample sample
    ) {
        if (PointerAction.isMoved(request.action())) {
            long generation = interactionGeneration.get();
            hoverQueue.submit(() -> {
                if (generation == interactionGeneration.get()) {
                    applyPointerInExecutionLane(request, intent, sample);
                }
            });
            return;
        }
        interactionGeneration.incrementAndGet();
        commandPublisher.execute(() -> applyPointerInExecutionLane(request, intent, sample));
    }

    @Override
    public void clearPointerSession() {
        interactionGeneration.incrementAndGet();
        commandPublisher.execute(pointerSession::clear);
    }

    private void applyPointerInExecutionLane(
            PointerInteractionRequest request,
            PointerWorkflowIntent intent,
            PointerSample sample
    ) {
        boolean accepted = pointerSession.accept(
                request.action(),
                intent.toolAction(),
                sample,
                request.projectionLevel());
        if (accepted && request.action() != null) {
            commandPublisher.applyInExecutionLane(() -> applyPointer(
                    request.action(),
                    intent.toolAction(),
                    sample,
                    intent.wallSingleClickMode(),
                    request.transitionDestination()));
        }
    }

    private static PointerInteractionRequest emptyRequest() {
        return new PointerInteractionRequest(
                null,
                DungeonEditorToolSelection.select(),
                DungeonEditorPointerGesture.none(),
                PointerInteractionTargets.empty(),
                0,
                TransitionDestination.empty());
    }

    private DungeonEditorRuntimeContext.Result applyPointer(
            PointerAction action,
            DungeonEditorToolAction tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DraftPointerResult draftResult =
                applyDraftPointer(action, tool, sample, wallSingleClickMode, transitionDestination);
        if (draftResult.handled()) {
            return draftResult.result();
        }
        DungeonEditorRuntimeContext.Result pointResult =
                applyPointPointer(action, tool, sample, wallSingleClickMode, transitionDestination);
        if (pointResult != null) {
            return pointResult;
        }
        DungeonEditorRuntimeContext.Result selectionResult =
                applySelectionPointer(action, tool, sample, wallSingleClickMode, transitionDestination);
        return selectionResult == null ? DungeonEditorRuntimeContext.Result.none() : selectionResult;
    }

    private DraftPointerResult applyDraftPointer(
            PointerAction action,
            DungeonEditorToolAction tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (DungeonEditorWallBoundaryDraftRuntimeOperation.handles(tool)) {
            return DraftPointerResult.handled(runtimeFamilies.wallBoundaryDraftOperation().apply(
                    action,
                    tool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination));
        }
        if (DungeonEditorDoorBoundaryDraftRuntimeOperation.handles(tool)) {
            return DraftPointerResult.handled(runtimeFamilies.doorBoundaryDraftOperation().apply(
                    action,
                    tool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination));
        }
        if (DungeonEditorCorridorDraftRuntimeOperation.handles(tool)) {
            return DraftPointerResult.handled(runtimeFamilies.corridorDraftOperation().apply(
                    action,
                    tool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination));
        }
        if (DungeonEditorStairDraftRuntimeOperation.handles(tool)) {
            return DraftPointerResult.handled(runtimeFamilies.stairDraftOperation().apply(
                    action,
                    tool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination));
        }
        return DraftPointerResult.notHandled();
    }

    private DungeonEditorRuntimeContext.Result applyPointPointer(
            PointerAction action,
            DungeonEditorToolAction editorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (DungeonEditorRoomPaintRuntimeOperation.handles(editorTool)) {
            return runtimeFamilies.roomPaintOperation()
                    .apply(action, editorTool, sample, wallSingleClickMode, transitionDestination);
        }
        if (DungeonEditorStairDeleteRuntimeOperation.handles(editorTool)) {
            return runtimeFamilies.stairDeleteOperation().apply(action, sample, wallSingleClickMode, transitionDestination);
        }
        if (DungeonEditorTransitionRuntimeOperation.handles(editorTool)) {
            return runtimeFamilies.transitionOperation()
                    .apply(action, editorTool, sample, wallSingleClickMode, transitionDestination);
        }
        if (DungeonEditorFeatureMarkerRuntimeOperation.handles(editorTool)) {
            return runtimeFamilies.featureMarkerOperation()
                    .apply(action, editorTool, sample, wallSingleClickMode, transitionDestination);
        }
        return null;
    }

    private DungeonEditorRuntimeContext.Result applySelectionPointer(
            PointerAction action,
            DungeonEditorToolAction tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (tool.isSelect()) {
            return runtimeFamilies.selectedHandleOperation().apply(action, sample, wallSingleClickMode, transitionDestination);
        }
        return null;
    }

    record RuntimeFamilies(
            DungeonEditorRoomPaintRuntimeOperation roomPaintOperation,
            DungeonEditorWallBoundaryDraftRuntimeOperation wallBoundaryDraftOperation,
            DungeonEditorDoorBoundaryDraftRuntimeOperation doorBoundaryDraftOperation,
            DungeonEditorCorridorDraftRuntimeOperation corridorDraftOperation,
            DungeonEditorStairDraftRuntimeOperation stairDraftOperation,
            DungeonEditorStairDeleteRuntimeOperation stairDeleteOperation,
            DungeonEditorTransitionRuntimeOperation transitionOperation,
            DungeonEditorFeatureMarkerRuntimeOperation featureMarkerOperation,
            DungeonEditorSelectedHandleRuntimeOperation selectedHandleOperation
    ) {
        RuntimeFamilies {
            Objects.requireNonNull(roomPaintOperation, "roomPaintOperation");
            Objects.requireNonNull(wallBoundaryDraftOperation, "wallBoundaryDraftOperation");
            Objects.requireNonNull(doorBoundaryDraftOperation, "doorBoundaryDraftOperation");
            Objects.requireNonNull(corridorDraftOperation, "corridorDraftOperation");
            Objects.requireNonNull(stairDraftOperation, "stairDraftOperation");
            Objects.requireNonNull(stairDeleteOperation, "stairDeleteOperation");
            Objects.requireNonNull(transitionOperation, "transitionOperation");
            Objects.requireNonNull(featureMarkerOperation, "featureMarkerOperation");
            Objects.requireNonNull(selectedHandleOperation, "selectedHandleOperation");
        }
    }

    private record DraftPointerResult(
            boolean handled,
            DungeonEditorRuntimeContext.Result result
    ) {
        static DraftPointerResult handled(DungeonEditorRuntimeContext.Result result) {
            return new DraftPointerResult(true, result);
        }

        static DraftPointerResult notHandled() {
            return new DraftPointerResult(false, DungeonEditorRuntimeContext.Result.none());
        }
    }
}
