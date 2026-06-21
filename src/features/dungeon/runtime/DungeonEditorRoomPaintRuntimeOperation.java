package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.features.dungeon.runtime.ApplyDungeonEditorToolWorkflowUseCase.PointerToolUseCase;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PaintSession;
import src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction;

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

    PointerToolUseCase roomWorkflow(DungeonEditorSessionValues.Tool tool) {
        return new PointerToolUseCase(
                input -> applyRoom(PointerAction.PRESS, input, tool),
                input -> applyRoom(PointerAction.DRAG, input, tool),
                input -> applyRoom(PointerAction.RELEASE, input, tool),
                null);
    }

    private void applyRoom(PointerAction action, DungeonEditorMainViewInput input, DungeonEditorSessionValues.Tool tool) {
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
