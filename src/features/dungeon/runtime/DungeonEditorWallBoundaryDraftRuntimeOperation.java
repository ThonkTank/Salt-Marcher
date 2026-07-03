package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceCoreGeometry;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorWallBoundaryDraftInterpretation.WallBoundaryCommit;

final class DungeonEditorWallBoundaryDraftRuntimeOperation {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;
    private final ApplyDungeonEditorAuthoredOperationUseCase authoredOperationUseCase;

    DungeonEditorWallBoundaryDraftRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
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
                effectUseCase.committedGridOrPublishCurrentResult();
        MapSnapshot committedSnapshot = currentGrid.committedSnapshot();
        if (committedSnapshot == null) {
            return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(currentGrid.snapshot());
        }
        PointerAction effectiveAction = DungeonEditorDraftOperationSupport.previewAction(action);
        DungeonEditorWallBoundaryDraftInterpretation interpretation =
                mainViewInterpreter.wallBoundaryOperation(
                        DungeonEditorDraftOperationSupport.pointerAction(effectiveAction),
                        input,
                        committedSnapshot,
                        workflow.session().selection(),
                        wallTool,
                        workflow.session().projectionLevel());
        return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(DungeonEditorDraftOperationSupport.latestSnapshot(
                currentGrid.snapshot(),
                effectUseCase.applyEffect(interpretation.effect(), commitFor(interpretation.commit()))));
    }

    private ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit commitFor(
            @Nullable WallBoundaryCommit commit
    ) {
        if (commit == null) {
            return null;
        }
        return mapId -> authoredOperationUseCase.executeClusterBoundaries(
                mapId,
                commit.clusterId(),
                DungeonEditorWorkspaceCoreGeometry.edges(DungeonEditorBoundaryDraftEffectHelper.edgeRefs(commit.edges())),
                BoundaryKind.WALL,
                commit.deleteMode());
    }

}
