package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.DragSession;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.InteractionState;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PaintSession;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

final class InterpretDungeonEditorMainViewDragUseCase {
    private final DungeonEditorBoundaryDraftUseCase boundaryDraft = new DungeonEditorBoundaryDraftUseCase();

    DungeonEditorMainViewInterpretation interpretSelection(
            PointerState input,
            InteractionState state
    ) {
        if (state.boundaryStretchSession().present()) {
            var nextStretchSession = state.boundaryStretchSession().withCurrentPointer(input.q(), input.r());
            InteractionState nextState = state.withBoundaryStretchSession(nextStretchSession);
            return new DungeonEditorMainViewInterpretation(nextState, previewFromStretch(nextStretchSession));
        }
        if (!state.dragSession().present()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorSessionEffect.clearPreviewIfNeeded(false));
        }
        DragSession nextDragSession = state.dragSession().withCurrentPointer(input.q(), input.r());
        InteractionState nextState = state.withDragSession(nextDragSession);
        DungeonEditorSessionEffect effect = nextDragSession.moved()
                ? DungeonEditorSessionEffect.preview(nextDragSession.moveHandlePreview())
                : DungeonEditorSessionEffect.clearPreviewIfNeeded(true);
        return new DungeonEditorMainViewInterpretation(nextState, effect);
    }

    DungeonEditorMainViewInterpretation interpretBoundary(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool,
            InteractionState state
    ) {
        if (!boundaryDragMatchesTool(input, boundaryTool)) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorSessionEffect.none());
        }
        return new DungeonEditorMainViewInterpretation(state, boundaryDraft.preview(input, snapshot, boundaryTool, state));
    }

    DungeonEditorMainViewInterpretation interpretRoom(
            PointerState input,
            InteractionState state
    ) {
        if (!input.primaryButtonDown()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorSessionEffect.none());
        }
        if (!state.paintSession().present()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorSessionEffect.clearPreviewIfNeeded(false));
        }
        PaintSession paintSession = state.paintSession().withEnd(input.q(), input.r());
        InteractionState nextState = state.withPaintSession(paintSession);
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.preview(paintSession.preview()));
    }

    private static DungeonEditorSessionEffect previewFromStretch(
            src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryStretchSession stretchSession
    ) {
        if (!stretchSession.present() || !stretchSession.moved()) {
            return DungeonEditorSessionEffect.clearPreviewIfNeeded(true);
        }
        return DungeonEditorSessionEffect.preview(stretchSession.preview());
    }

    private static boolean boundaryDragMatchesTool(
            PointerState input,
            DungeonEditorSessionValues.Tool boundaryTool
    ) {
        return boundaryTool.deleteMode() ? input.secondaryButtonDown() : input.primaryButtonDown();
    }

}
