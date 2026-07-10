package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorCorridorDraftRuntimeOperation {
    private final DungeonEditorDraftRuntimeContext context;
    private final DungeonEditorDraftAuthoredCommitter authoredCommitter;

    DungeonEditorCorridorDraftRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        context = DungeonEditorDraftRuntimeContext.from(runtime);
        authoredCommitter = DungeonEditorDraftAuthoredCommitter.from(runtime);
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
                context.currentGridOrPublishCurrentResult();
        MapSnapshot committedSnapshot = currentGrid.committedSnapshot();
        if (committedSnapshot == null) {
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(currentGrid.snapshot());
        }
        PointerAction effectiveAction = DungeonEditorDraftOperationSupport.previewAction(action);
        src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect effect =
                context.corridor(
                        DungeonEditorDraftOperationSupport.pointerAction(effectiveAction),
                        input,
                        committedSnapshot,
                        corridorTool);
        return DungeonEditorRuntimeResultTranslator.fromPublication(
                currentGrid.snapshot(),
                context.applyEffect(effect, commitFor(effect.getApplyPreview())));
    }

    private ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit commitFor(
            DungeonEditorSessionValues.@Nullable Preview preview
    ) {
        return switch (preview) {
            case DungeonEditorSessionValues.CorridorCreatePreview corridor ->
                    mapId -> authoredCommitter.createCorridor(mapId, corridor);
            case DungeonEditorSessionValues.DeleteCorridorPreview corridor ->
                    mapId -> authoredCommitter.deleteCorridor(mapId, corridor);
            case null, default -> null;
        };
    }

}
