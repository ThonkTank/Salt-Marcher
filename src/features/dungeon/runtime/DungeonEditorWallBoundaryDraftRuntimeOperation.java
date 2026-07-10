package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorWallBoundaryDraftInterpretation.WallBoundaryCommit;

final class DungeonEditorWallBoundaryDraftRuntimeOperation {
    private final DungeonEditorDraftRuntimeContext context;
    private final DungeonEditorDraftAuthoredCommitter authoredCommitter;

    DungeonEditorWallBoundaryDraftRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        context = DungeonEditorDraftRuntimeContext.from(runtime);
        authoredCommitter = DungeonEditorDraftAuthoredCommitter.from(runtime);
    }

    static boolean handles(DungeonEditorTool tool) {
        return tool == DungeonEditorTool.WALL_CREATE || tool == DungeonEditorTool.WALL_DELETE;
    }

    DungeonEditorRuntimeOperationResult apply(
            PointerAction action,
            DungeonEditorTool wallTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        if (wallTool == DungeonEditorTool.WALL_CREATE) {
            return applyWorkflow(action, input, DungeonEditorSessionValues.Tool.WALL_CREATE);
        } else if (wallTool == DungeonEditorTool.WALL_DELETE) {
            return applyWorkflow(action, input, DungeonEditorSessionValues.Tool.WALL_DELETE);
        } else {
            throw new IllegalArgumentException("Unsupported wall draft tool: " + wallTool);
        }
    }

    private DungeonEditorRuntimeOperationResult applyWorkflow(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool wallTool
    ) {
        ApplyDungeonEditorSessionEffectUseCase.CurrentGridPublication currentGrid =
                context.currentGridOrPublishCurrentResult();
        MapSnapshot committedSnapshot = currentGrid.committedSnapshot();
        if (committedSnapshot == null) {
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(currentGrid.snapshot());
        }
        PointerAction effectiveAction = DungeonEditorDraftOperationSupport.previewAction(action);
        DungeonEditorWallBoundaryDraftInterpretation interpretation =
                context.wallBoundaryOperation(
                        DungeonEditorDraftOperationSupport.pointerAction(effectiveAction),
                        input,
                        committedSnapshot,
                        wallTool);
        return DungeonEditorRuntimeResultTranslator.fromPublication(
                currentGrid.snapshot(),
                context.applyEffect(interpretation.effect(), commitFor(interpretation.commit())));
    }

    private ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit commitFor(
            @Nullable WallBoundaryCommit commit
    ) {
        if (commit == null) {
            return null;
        }
        return mapId -> authoredCommitter.applyWallBoundary(mapId, commit);
    }

}
