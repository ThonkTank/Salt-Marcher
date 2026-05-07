package src.domain.dungeoneditor.application;

import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewEffect;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryStretchSession;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.DragSession;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PaintSession;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInterpretation;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;

final class InterpretDungeonEditorMainViewReleaseUseCase {

    DungeonEditorMainViewInterpretation interpret(
            PointerState input,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (state.paintSession().present() && roomPaintToolSelected(selectedTool)) {
            PaintSession released = input == null
                    ? state.paintSession()
                    : state.paintSession().withEnd(input.q(), input.r());
            return new DungeonEditorMainViewInterpretation(
                    state.withPaintSession(PaintSession.none()),
                    DungeonEditorMainViewEffect.apply(released.preview()));
        }
        if (state.boundaryStretchSession().present()) {
            BoundaryStretchSession releasedSession = input == null
                    ? state.boundaryStretchSession()
                    : state.boundaryStretchSession().withCurrentPointer(input.q(), input.r());
            InteractionState nextState = state.withBoundaryStretchSession(BoundaryStretchSession.none());
            if (!selectionToolSelected(selectedTool)) {
                return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.none());
            }
            if (!releasedSession.moved()) {
                return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.select(releasedSession.selection()));
            }
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.apply(releasedSession.preview()));
        }
        if (!state.dragSession().present() || input == null) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.clearPreviewIfNeeded(false));
        }
        DragSession releasedSession = state.dragSession();
        InteractionState nextState = state.withDragSession(DragSession.none());
        if (!selectionToolSelected(selectedTool) || !releasedSession.moved()) {
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.clearPreviewIfNeeded(true));
        }
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.apply(releasedSession.moveHandlePreview()));
    }

    private static boolean selectionToolSelected(DungeonEditorSessionValues.Tool selectedTool) {
        return selectedTool != null && selectedTool.isSelectionTool();
    }

    private static boolean roomPaintToolSelected(DungeonEditorSessionValues.Tool selectedTool) {
        return selectedTool != null && selectedTool.isRoomPaintTool();
    }
}
