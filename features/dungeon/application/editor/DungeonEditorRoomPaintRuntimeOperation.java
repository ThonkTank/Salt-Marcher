package features.dungeon.application.editor;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.application.editor.DungeonEditorRuntimeApplicationService;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PaintSession;

final class DungeonEditorRoomPaintRuntimeOperation {
    private final DungeonEditorRuntimeContext context;

    DungeonEditorRoomPaintRuntimeOperation(DungeonEditorRuntimeContext context) {
        this.context = Objects.requireNonNull(context, "context");
    }

    static boolean handles(DungeonEditorToolAction tool) {
        return tool != null && tool.family() == DungeonEditorToolFamily.ROOM;
    }

    DungeonEditorRuntimeContext.Result apply(
            PointerAction action,
            DungeonEditorToolAction tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (action == null || tool == null || PointerAction.isMoved(action)) {
            return DungeonEditorRuntimeContext.Result.none();
        }
        DungeonEditorMainViewInput input = DungeonEditorMainViewInput.fromPointer(
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
            DungeonEditorToolAction tool
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
