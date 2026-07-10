package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorDoorBoundaryDraftInterpretation.DoorBoundaryCommit;

final class DungeonEditorDoorBoundaryDraftRuntimeOperation {
    private final DungeonEditorDraftRuntimeContext context;
    private final DungeonEditorDraftAuthoredCommitter authoredCommitter;

    DungeonEditorDoorBoundaryDraftRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        context = DungeonEditorDraftRuntimeContext.from(runtime);
        authoredCommitter = DungeonEditorDraftAuthoredCommitter.from(runtime);
    }

    static boolean handles(DungeonEditorTool tool) {
        return tool == DungeonEditorTool.DOOR_CREATE || tool == DungeonEditorTool.DOOR_DELETE;
    }

    DungeonEditorRuntimeOperationResult apply(
            PointerAction action,
            DungeonEditorTool doorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
        ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                doorTool == DungeonEditorTool.DOOR_DELETE,
                transitionDestination);
        if (doorTool == DungeonEditorTool.DOOR_CREATE) {
            return applyWorkflow(action, input, DungeonEditorSessionValues.Tool.DOOR_CREATE);
        } else if (doorTool == DungeonEditorTool.DOOR_DELETE) {
            return applyWorkflow(action, input, DungeonEditorSessionValues.Tool.DOOR_DELETE);
        } else {
            throw new IllegalArgumentException("Unsupported door draft tool: " + doorTool);
        }
    }

    private DungeonEditorRuntimeOperationResult applyWorkflow(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool doorTool
    ) {
        ApplyDungeonEditorSessionEffectUseCase.CurrentGridPublication currentGrid =
                context.currentGridOrPublishCurrentResult();
        MapSnapshot committedSnapshot = currentGrid.committedSnapshot();
        if (committedSnapshot == null) {
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(currentGrid.snapshot());
        }
        PointerAction effectiveAction = DungeonEditorDraftOperationSupport.previewAction(action);
        DungeonEditorDoorBoundaryDraftInterpretation interpretation =
                context.doorBoundaryOperation(
                        DungeonEditorDraftOperationSupport.pointerAction(effectiveAction),
                        input,
                        committedSnapshot,
                        doorTool);
        return DungeonEditorRuntimeResultTranslator.fromPublication(
                currentGrid.snapshot(),
                context.applyEffect(interpretation.effect(), commitFor(interpretation.commit())));
    }

    private ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit commitFor(
            @Nullable DoorBoundaryCommit commit
    ) {
        if (commit == null) {
            return null;
        }
        return mapId -> authoredCommitter.applyDoorBoundary(mapId, commit);
    }

}
