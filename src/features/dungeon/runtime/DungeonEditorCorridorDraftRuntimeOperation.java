package src.features.dungeon.runtime;

import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.DRAG;
import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.HOVER;
import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.PRESS;
import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.RELEASE;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

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

    static @Nullable DungeonEditorTool corridorTool(String toolKey) {
        DungeonEditorTool tool = DungeonEditorRuntimeEnumTranslator.editorTool(toolKey);
        return tool == DungeonEditorTool.CORRIDOR_CREATE || tool == DungeonEditorTool.CORRIDOR_DELETE ? tool : null;
    }

    void apply(
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
            applyWorkflow(action, input, DungeonEditorSessionValues.Tool.CORRIDOR_CREATE);
        } else if (corridorTool == DungeonEditorTool.CORRIDOR_DELETE) {
            applyWorkflow(action, input, DungeonEditorSessionValues.Tool.CORRIDOR_DELETE);
        } else {
            throw new IllegalArgumentException("Unsupported corridor draft tool: " + corridorTool);
        }
    }

    private void applyWorkflow(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool corridorTool
    ) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        PointerAction effectiveAction = previewAction(action);
        src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect effect =
                mainViewInterpreter.corridor(
                        pointerAction(effectiveAction),
                        input,
                        committedSnapshot,
                        corridorTool,
                        workflow.session().projectionLevel());
        effectUseCase.applyEffect(effect, commitFor(effect.getApplyPreview()));
    }

    private static PointerAction previewAction(PointerAction action) {
        return action == null ? PointerAction.MOVED : action;
    }

    private static InterpretDungeonEditorMainViewInputUseCase.PointerAction pointerAction(PointerAction action) {
        return switch (action) {
            case PRESSED -> PRESS;
            case DRAGGED -> DRAG;
            case RELEASED -> RELEASE;
            case MOVED -> HOVER;
        };
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
