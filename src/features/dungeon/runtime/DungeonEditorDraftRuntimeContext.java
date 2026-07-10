package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;

final class DungeonEditorDraftRuntimeContext {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    private DungeonEditorDraftRuntimeContext(
            DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime
    ) {
        DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases safeRuntime =
                Objects.requireNonNull(runtime, "runtime");
        workflow = Objects.requireNonNull(safeRuntime.workflow(), "workflow");
        mainViewInterpreter = Objects.requireNonNull(safeRuntime.mainViewInterpreter(), "mainViewInterpreter");
        effectUseCase = Objects.requireNonNull(safeRuntime.effectUseCase(), "effectUseCase");
    }

    static DungeonEditorDraftRuntimeContext from(
            DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime
    ) {
        return new DungeonEditorDraftRuntimeContext(runtime);
    }

    ApplyDungeonEditorSessionEffectUseCase.CurrentGridPublication currentGridOrPublishCurrentResult() {
        return effectUseCase.committedGridOrPublishCurrentResult();
    }

    ApplyDungeonEditorSessionEffectUseCase.PublicationResult applyEffect(
            DungeonEditorSessionEffect effect,
            ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit authoredCommit
    ) {
        return effectUseCase.applyEffect(effect, authoredCommit);
    }

    DungeonEditorSessionEffect corridor(
            InterpretDungeonEditorMainViewInputUseCase.PointerAction action,
            DungeonEditorMainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool corridorTool
    ) {
        return mainViewInterpreter.corridor(
                action,
                input,
                snapshot,
                corridorTool,
                workflow.session().projectionLevel());
    }

    DungeonEditorDoorBoundaryDraftInterpretation doorBoundaryOperation(
            InterpretDungeonEditorMainViewInputUseCase.PointerAction action,
            DungeonEditorMainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool
    ) {
        return mainViewInterpreter.doorBoundaryOperation(
                action,
                input,
                snapshot,
                boundaryTool,
                workflow.session().projectionLevel());
    }

    DungeonEditorWallBoundaryDraftInterpretation wallBoundaryOperation(
            InterpretDungeonEditorMainViewInputUseCase.PointerAction action,
            DungeonEditorMainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool
    ) {
        return mainViewInterpreter.wallBoundaryOperation(
                action,
                input,
                snapshot,
                workflow.session().selection(),
                boundaryTool,
                workflow.session().projectionLevel());
    }
}
