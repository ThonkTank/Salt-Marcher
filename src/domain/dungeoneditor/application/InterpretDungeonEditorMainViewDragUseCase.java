package src.domain.dungeoneditor.application;

import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.DragSession;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PaintSession;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;

final class InterpretDungeonEditorMainViewDragUseCase {
    private final DungeonEditorBoundaryDraftUseCase boundaryDraft = new DungeonEditorBoundaryDraftUseCase();

    DungeonEditorMainViewInterpretation interpret(
            PointerState input,
            DungeonSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (!input.primaryButtonDown()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.none());
        }
        if (state.boundaryStretchSession().present()) {
            var nextStretchSession = state.boundaryStretchSession().withCurrentPointer(input.q(), input.r());
            InteractionState nextState = state.withBoundaryStretchSession(nextStretchSession);
            return new DungeonEditorMainViewInterpretation(nextState, previewFromStretch(nextStretchSession));
        }
        if (boundaryToolSelected(selectedTool)) {
            return new DungeonEditorMainViewInterpretation(state, boundaryDraft.preview(input, snapshot, selectedTool, state));
        }
        if (state.paintSession().present() && roomPaintToolSelected(selectedTool)) {
            PaintSession paintSession = state.paintSession().withEnd(input.q(), input.r());
            InteractionState nextState = state.withPaintSession(paintSession);
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.preview(paintSession.preview()));
        }
        if (!selectionToolSelected(selectedTool) || !state.dragSession().present()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.clearPreviewIfNeeded(false));
        }
        DragSession nextDragSession = state.dragSession().withCurrentPointer(input.q(), input.r());
        InteractionState nextState = state.withDragSession(nextDragSession);
        DungeonEditorMainViewEffect effect = nextDragSession.moved()
                ? DungeonEditorMainViewEffect.preview(nextDragSession.moveHandlePreview())
                : DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
        return new DungeonEditorMainViewInterpretation(nextState, effect);
    }

    private static DungeonEditorMainViewEffect previewFromStretch(
            src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryStretchSession stretchSession
    ) {
        if (!stretchSession.present() || !stretchSession.moved()) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
        }
        return DungeonEditorMainViewEffect.preview(stretchSession.preview());
    }

    private static boolean selectionToolSelected(DungeonEditorSessionValues.Tool selectedTool) {
        return selectedTool != null && selectedTool.isSelectionTool();
    }

    private static boolean boundaryToolSelected(DungeonEditorSessionValues.Tool selectedTool) {
        return selectedTool != null && selectedTool.isBoundaryTool();
    }

    private static boolean roomPaintToolSelected(DungeonEditorSessionValues.Tool selectedTool) {
        return selectedTool != null && selectedTool.isRoomPaintTool();
    }
}
