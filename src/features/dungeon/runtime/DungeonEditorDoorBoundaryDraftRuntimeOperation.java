package src.features.dungeon.runtime;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceCoreGeometry;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorDoorBoundaryDraftInterpretation.DoorBoundaryCommit;

final class DungeonEditorDoorBoundaryDraftRuntimeOperation {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;
    private final ApplyDungeonEditorAuthoredOperationUseCase authoredOperationUseCase;

    DungeonEditorDoorBoundaryDraftRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
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
                effectUseCase.committedGridOrPublishCurrentResult();
        MapSnapshot committedSnapshot = currentGrid.committedSnapshot();
        if (committedSnapshot == null) {
            return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(currentGrid.snapshot());
        }
        PointerAction effectiveAction = DungeonEditorDraftOperationSupport.previewAction(action);
        DungeonEditorDoorBoundaryDraftInterpretation interpretation =
                mainViewInterpreter.doorBoundaryOperation(
                        DungeonEditorDraftOperationSupport.pointerAction(effectiveAction),
                        input,
                        committedSnapshot,
                        doorTool,
                        workflow.session().projectionLevel());
        return DungeonEditorAuthoredRuntimeOperations.resultFromPublication(
                currentGrid.snapshot(),
                effectUseCase.applyEffect(interpretation.effect(), commitFor(interpretation.commit())));
    }

    private ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit commitFor(
            @Nullable DoorBoundaryCommit commit
    ) {
        if (commit == null) {
            return null;
        }
        return mapId -> authoredOperationUseCase.executeDoorBoundary(
                mapId,
                commit.clusterId(),
                DungeonEditorWorkspaceCoreGeometry.edges(List.of(commit.edge().toEdgeRef())),
                commit.deleteMode());
    }

}
