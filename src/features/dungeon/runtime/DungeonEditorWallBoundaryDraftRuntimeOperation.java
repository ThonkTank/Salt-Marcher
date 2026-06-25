package src.features.dungeon.runtime;

import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.DRAG;
import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.HOVER;
import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.PRESS;
import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.RELEASE;

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

    static @Nullable DungeonEditorTool wallTool(String toolKey) {
        DungeonEditorTool tool = DungeonEditorRuntimeEnumTranslator.editorTool(toolKey);
        return tool == DungeonEditorTool.WALL_CREATE || tool == DungeonEditorTool.WALL_DELETE ? tool : null;
    }

    void apply(
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
            applyWorkflow(action, input, DungeonEditorSessionValues.Tool.WALL_CREATE);
        } else if (wallTool == DungeonEditorTool.WALL_DELETE) {
            applyWorkflow(action, input, DungeonEditorSessionValues.Tool.WALL_DELETE);
        } else {
            throw new IllegalArgumentException("Unsupported wall draft tool: " + wallTool);
        }
    }

    private void applyWorkflow(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool wallTool
    ) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        PointerAction effectiveAction = previewAction(action);
        DungeonEditorWallBoundaryDraftInterpretation interpretation =
                mainViewInterpreter.wallBoundaryOperation(
                        pointerAction(effectiveAction),
                        input,
                        committedSnapshot,
                        workflow.session().selection(),
                        wallTool,
                        workflow.session().projectionLevel());
        effectUseCase.applyEffect(interpretation.effect(), commitFor(interpretation.commit()));
    }

    private static PointerAction previewAction(PointerAction action) {
        return PointerAction.orMoved(action);
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
