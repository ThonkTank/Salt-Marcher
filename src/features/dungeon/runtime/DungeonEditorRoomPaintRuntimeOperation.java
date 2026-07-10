package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PaintSession;

final class DungeonEditorRoomPaintRuntimeOperation {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;
    private final DungeonAuthoredApplicationService authoredService;
    private final DungeonAuthoredApplicationService.Session authoredSession;

    DungeonEditorRoomPaintRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases safeRuntime =
                Objects.requireNonNull(runtime, "runtime");
        workflow = Objects.requireNonNull(safeRuntime.workflow(), "workflow");
        mainViewInterpreter = Objects.requireNonNull(safeRuntime.mainViewInterpreter(), "mainViewInterpreter");
        effectUseCase = Objects.requireNonNull(safeRuntime.effectUseCase(), "effectUseCase");
        authoredService = Objects.requireNonNull(safeRuntime.authoredService(), "authoredService");
        authoredSession = Objects.requireNonNull(safeRuntime.authored(), "authoredSession");
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

    DungeonEditorRuntimeOperationResult apply(
            PointerAction action,
            DungeonEditorSessionValues.Tool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (action == null || tool == null || PointerAction.isMoved(action)) {
            return DungeonEditorRuntimeOperationResult.none();
        }
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        switch (action) {
            case PRESSED -> {
                return applyRoom(
                    InterpretDungeonEditorMainViewInputUseCase.PointerAction.PRESS,
                    input,
                    tool);
            }
            case DRAGGED -> {
                return applyRoom(
                    InterpretDungeonEditorMainViewInputUseCase.PointerAction.DRAG,
                    input,
                    tool);
            }
            case RELEASED -> {
                return applyRoom(
                    InterpretDungeonEditorMainViewInputUseCase.PointerAction.RELEASE,
                    input,
                    tool);
            }
            default -> throw new IllegalStateException("Unsupported room paint pointer action: " + action);
        }
    }

    private DungeonEditorRuntimeOperationResult applyRoom(
            InterpretDungeonEditorMainViewInputUseCase.PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool tool
    ) {
        if (effectUseCase.committedGridOrPublishCurrent() == null) {
            return DungeonEditorRuntimeOperationResult.none();
        }
        DungeonEditorRoomPaintInterpretation interpretation = mainViewInterpreter.roomPaintOperation(
                action,
                input,
                tool,
                workflow.session().projectionLevel());
        return DungeonEditorRuntimeResultTranslator.fromPublication(
                effectUseCase.applyEffect(interpretation.effect(), commitFor(interpretation.commitSession())));
    }

    private ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit commitFor(PaintSession paintSession) {
        if (!paintSession.present()) {
            return null;
        }
        return mapId -> authoredService.applyRoomRectangle(
                mapId,
                startCell(paintSession),
                endCell(paintSession),
                paintSession.deleteMode(),
                authoredSession);
    }

    private static Cell startCell(PaintSession paintSession) {
        return new Cell(paintSession.startQ(), paintSession.startR(), paintSession.level());
    }

    private static Cell endCell(PaintSession paintSession) {
        return new Cell(paintSession.endQ(), paintSession.endR(), paintSession.level());
    }
}
