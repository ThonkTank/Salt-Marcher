package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.DungeonEditorRuntimeApplicationService;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PaintSession;

final class DungeonEditorRoomPaintRuntimeOperation {
    private final DungeonEditorRuntimeContext context;

    DungeonEditorRoomPaintRuntimeOperation(DungeonEditorRuntimeContext context) {
        this.context = Objects.requireNonNull(context, "context");
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

    DungeonEditorRuntimeContext.Result apply(
            PointerAction action,
            DungeonEditorSessionValues.Tool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (action == null || tool == null || PointerAction.isMoved(action)) {
            return DungeonEditorRuntimeContext.Result.none();
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

    private DungeonEditorRuntimeContext.Result applyRoom(
            InterpretDungeonEditorMainViewInputUseCase.PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool tool
    ) {
        if (context.currentGridOrPublishCurrentResult().committedSnapshot() == null) {
            return DungeonEditorRuntimeContext.Result.none();
        }
        DungeonEditorRoomPaintInterpretation interpretation = context.roomPaintInterpretation(
                action,
                input,
                tool);
        return context.fromPublication(
                context.applyEffectPublication(interpretation.effect(), commitFor(interpretation.commitSession())));
    }

    private DungeonEditorRuntimeApplicationService.@Nullable AuthoredCommit commitFor(PaintSession paintSession) {
        if (!paintSession.present()) {
            return null;
        }
        return mapId -> context.applyRoomRectangle(
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
