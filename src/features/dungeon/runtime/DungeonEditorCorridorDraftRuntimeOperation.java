package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorCorridorDraftRuntimeOperation {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;
    private final ApplyDungeonEditorAuthoredOperationUseCase authoredOperationUseCase;

    DungeonEditorCorridorDraftRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases safeRuntime =
                Objects.requireNonNull(runtime, "runtime");
        workflow = Objects.requireNonNull(safeRuntime.workflow(), "workflow");
        mainViewInterpreter = Objects.requireNonNull(safeRuntime.mainViewInterpreter(), "mainViewInterpreter");
        effectUseCase = Objects.requireNonNull(safeRuntime.effectUseCase(), "effectUseCase");
        authoredOperationUseCase = Objects.requireNonNull(
                safeRuntime.authored().applyOperationUseCase(),
                "authoredOperationUseCase");
    }

    static boolean handles(DungeonEditorTool tool) {
        return tool == DungeonEditorTool.CORRIDOR_CREATE || tool == DungeonEditorTool.CORRIDOR_DELETE;
    }

    DungeonEditorRuntimeOperationResult apply(
            PointerAction action,
            DungeonEditorTool corridorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        if (corridorTool == DungeonEditorTool.CORRIDOR_CREATE) {
            return applyWorkflow(action, input, DungeonEditorSessionValues.Tool.CORRIDOR_CREATE);
        } else if (corridorTool == DungeonEditorTool.CORRIDOR_DELETE) {
            return applyWorkflow(action, input, DungeonEditorSessionValues.Tool.CORRIDOR_DELETE);
        } else {
            throw new IllegalArgumentException("Unsupported corridor draft tool: " + corridorTool);
        }
    }

    private DungeonEditorRuntimeOperationResult applyWorkflow(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool corridorTool
    ) {
        ApplyDungeonEditorSessionEffectUseCase.CurrentGridPublication currentGrid =
                effectUseCase.committedGridOrPublishCurrentResult();
        MapSnapshot committedSnapshot = currentGrid.committedSnapshot();
        if (committedSnapshot == null) {
            return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(currentGrid.snapshot());
        }
        PointerAction effectiveAction = DungeonEditorDraftOperationSupport.previewAction(action);
        src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect effect =
                mainViewInterpreter.corridor(
                        DungeonEditorDraftOperationSupport.pointerAction(effectiveAction),
                        input,
                        committedSnapshot,
                        corridorTool,
                        workflow.session().projectionLevel());
        return DungeonEditorAuthoredRuntimeOperations.resultFromPublication(
                currentGrid.snapshot(),
                effectUseCase.applyEffect(effect, commitFor(effect.getApplyPreview())));
    }

    private ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit commitFor(
            DungeonEditorSessionValues.@Nullable Preview preview
    ) {
        return switch (preview) {
            case DungeonEditorSessionValues.CorridorCreatePreview corridor ->
                    mapId -> authoredOperationUseCase.executeCreateCorridor(
                            mapId,
                            corridor.start(),
                            corridor.end());
            case DungeonEditorSessionValues.DeleteCorridorPreview corridor ->
                    mapId -> authoredOperationUseCase.executeDeleteCorridor(
                            mapId,
                            corridor.corridorId(),
                            corridor.targetKind(),
                            corridor.topologyRefId(),
                            corridor.roomId(),
                            corridor.waypointIndex());
            case null, default -> null;
        };
    }

}
