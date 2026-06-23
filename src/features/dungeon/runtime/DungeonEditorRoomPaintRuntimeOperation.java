package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PaintSession;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

final class DungeonEditorRoomPaintRuntimeOperation {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;
    private final ApplyDungeonEditorAuthoredOperationUseCase authoredOperationUseCase;

    DungeonEditorRoomPaintRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases safeRuntime =
                Objects.requireNonNull(runtime, "runtime");
        workflow = Objects.requireNonNull(safeRuntime.workflow(), "workflow");
        mainViewInterpreter = Objects.requireNonNull(safeRuntime.mainViewInterpreter(), "mainViewInterpreter");
        effectUseCase = Objects.requireNonNull(safeRuntime.effectUseCase(), "effectUseCase");
        authoredOperationUseCase = Objects.requireNonNull(
                safeRuntime.authored().applyOperationUseCase(),
                "authoredOperationUseCase");
    }

    static DungeonEditorSessionValues.Tool roomTool(DungeonEditorTool tool) {
        if (tool == DungeonEditorTool.ROOM_PAINT) {
            return DungeonEditorSessionValues.Tool.ROOM_PAINT;
        }
        if (tool == DungeonEditorTool.ROOM_DELETE) {
            return DungeonEditorSessionValues.Tool.ROOM_DELETE;
        }
        return null;
    }

    void apply(
            PointerAction action,
            DungeonEditorSessionValues.Tool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (action == null || tool == null || action == PointerAction.MOVED) {
            return;
        }
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        switch (action) {
            case PRESSED -> applyRoom(
                    InterpretDungeonEditorMainViewInputUseCase.PointerAction.PRESS,
                    input,
                    tool);
            case DRAGGED -> applyRoom(
                    InterpretDungeonEditorMainViewInputUseCase.PointerAction.DRAG,
                    input,
                    tool);
            case RELEASED -> applyRoom(
                    InterpretDungeonEditorMainViewInputUseCase.PointerAction.RELEASE,
                    input,
                    tool);
            default -> throw new IllegalStateException("Unsupported room paint pointer action: " + action);
        }
    }

    private void applyRoom(
            InterpretDungeonEditorMainViewInputUseCase.PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool tool
    ) {
        if (effectUseCase.committedGridOrPublishCurrent() == null) {
            return;
        }
        DungeonEditorRoomPaintInterpretation interpretation = mainViewInterpreter.roomPaintOperation(
                action,
                input,
                tool,
                workflow.session().projectionLevel());
        effectUseCase.applyEffect(interpretation.effect(), commitFor(interpretation.commitSession()));
    }

    private ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit commitFor(PaintSession paintSession) {
        if (!paintSession.present()) {
            return null;
        }
        return mapId -> authoredOperationUseCase.executeRoomRectangle(
                mapId,
                startCell(paintSession),
                endCell(paintSession),
                paintSession.deleteMode());
    }

    private static Cell startCell(PaintSession paintSession) {
        return new Cell(paintSession.startQ(), paintSession.startR(), paintSession.level());
    }

    private static Cell endCell(PaintSession paintSession) {
        return new Cell(paintSession.endQ(), paintSession.endR(), paintSession.level());
    }
}
