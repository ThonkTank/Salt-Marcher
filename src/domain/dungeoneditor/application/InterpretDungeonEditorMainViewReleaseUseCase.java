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
        if (state.paintSession().present()) {
            return releasePaintSession(input, selectedTool, state);
        }
        if (state.boundaryStretchSession().present()) {
            return releaseBoundaryStretchSession(input, selectedTool, state);
        }
        if (!state.dragSession().present()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.clearPreviewIfNeeded(false));
        }
        return releaseDragSession(input, selectedTool, state);
    }

    private static DungeonEditorMainViewInterpretation releasePaintSession(
            PointerState input,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (!roomPaintToolSelected(selectedTool)) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.none());
        }
        PaintSession released = input == null
                ? state.paintSession()
                : state.paintSession().withEnd(input.q(), input.r());
        return new DungeonEditorMainViewInterpretation(
                state.withPaintSession(PaintSession.none()),
                DungeonEditorMainViewEffect.apply(released.preview()));
    }

    private static DungeonEditorMainViewInterpretation releaseBoundaryStretchSession(
            PointerState input,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
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

    private static DungeonEditorMainViewInterpretation releaseDragSession(
            PointerState input,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (input == null) {
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
