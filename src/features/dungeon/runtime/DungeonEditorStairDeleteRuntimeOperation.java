package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorStairDeleteRuntimeOperation {
    private static final long NO_STAIR_ID = 0L;

    private final DungeonEditorSessionWorkflow workflow;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;
    private final DungeonAuthoredApplicationService authoredService;
    private final DungeonAuthoredApplicationService.Session authoredSession;

    DungeonEditorStairDeleteRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases safeRuntime =
                Objects.requireNonNull(runtime, "runtime");
        workflow = Objects.requireNonNull(safeRuntime.workflow(), "workflow");
        effectUseCase = Objects.requireNonNull(safeRuntime.effectUseCase(), "effectUseCase");
        authoredService = Objects.requireNonNull(safeRuntime.authoredService(), "authoredService");
        authoredSession = Objects.requireNonNull(safeRuntime.authored(), "authoredSession");
    }

    static boolean handles(DungeonEditorTool tool) {
        return tool == DungeonEditorTool.STAIR_DELETE;
    }

    DungeonEditorRuntimeOperationResult apply(
            PointerAction action,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (!PointerAction.isPressed(action)) {
            return DungeonEditorRuntimeOperationResult.none();
        }
        if (!workflow.session().hasSelectedMap()) {
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        }
        long stairId = DungeonEditorPointRuntimeTarget.targetId(
                sample,
                wallSingleClickMode,
                transitionDestination,
                DungeonTopologyElementKind.STAIR);
        if (stairId <= NO_STAIR_ID) {
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        }
        boolean deleted = authoredService.deleteStair(workflow.session().selectedMapId(), stairId, authoredSession);
        if (deleted) {
            workflow.applyEffect(DungeonEditorSessionEffect.clearedSelection());
            workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        }
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
    }

}
