package src.features.dungeon.runtime;

import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.DRAG;
import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.HOVER;
import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.PRESS;
import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.RELEASE;

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

    static @Nullable DungeonEditorTool doorTool(String toolKey) {
        DungeonEditorTool tool = DungeonEditorRuntimeEnumTranslator.editorTool(toolKey);
        return tool == DungeonEditorTool.DOOR_CREATE || tool == DungeonEditorTool.DOOR_DELETE ? tool : null;
    }

    void apply(
            PointerAction action,
            DungeonEditorTool doorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                doorTool.name(),
                sample,
                wallSingleClickMode,
                transitionDestination);
        if (doorTool == DungeonEditorTool.DOOR_CREATE) {
            applyWorkflow(action, input, DungeonEditorSessionValues.Tool.DOOR_CREATE);
        } else if (doorTool == DungeonEditorTool.DOOR_DELETE) {
            applyWorkflow(action, input, DungeonEditorSessionValues.Tool.DOOR_DELETE);
        } else {
            throw new IllegalArgumentException("Unsupported door draft tool: " + doorTool);
        }
    }

    private void applyWorkflow(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool doorTool
    ) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        PointerAction effectiveAction = previewAction(action);
        DungeonEditorDoorBoundaryDraftInterpretation interpretation =
                mainViewInterpreter.doorBoundaryOperation(
                        pointerAction(effectiveAction),
                        input,
                        committedSnapshot,
                        doorTool,
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
