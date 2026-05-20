package src.domain.dungeon.model.editor.usecase;

import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryStretchSession;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.DragSession;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PaintSession;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInterpretation;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

final class InterpretDungeonEditorMainViewReleaseUseCase {
    private final DungeonEditorBoundaryDraftUseCase boundaryDraft = new DungeonEditorBoundaryDraftUseCase();

    DungeonEditorMainViewInterpretation interpretSelection(
            PointerState input,
            InteractionState state
    ) {
        if (state.boundaryStretchSession().present()) {
            return releaseBoundaryStretchSession(input, state);
        }
        if (!state.dragSession().present()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.clearPreviewIfNeeded(false));
        }
        return releaseDragSession(input, state);
    }

    DungeonEditorMainViewInterpretation interpretRoom(
            PointerState input,
            InteractionState state
    ) {
        if (state.paintSession().present()) {
            return releasePaintSession(input, state);
        }
        return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.clearPreviewIfNeeded(false));
    }

    DungeonEditorMainViewInterpretation interpretBoundary(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool,
            InteractionState state
    ) {
        return boundaryDraft.release(input, snapshot, boundaryTool, state);
    }

    private static DungeonEditorMainViewInterpretation releasePaintSession(
            PointerState input,
            InteractionState state
    ) {
        PaintSession released = input == null
                ? state.paintSession()
                : state.paintSession().withEnd(input.q(), input.r());
        return new DungeonEditorMainViewInterpretation(
                state.withPaintSession(PaintSession.none()),
                DungeonEditorMainViewEffect.apply(released.preview()));
    }

    private static DungeonEditorMainViewInterpretation releaseBoundaryStretchSession(
            PointerState input,
            InteractionState state
    ) {
        BoundaryStretchSession releasedSession = input == null
                ? state.boundaryStretchSession()
                : state.boundaryStretchSession().withCurrentPointer(input.q(), input.r());
        InteractionState nextState = state.withBoundaryStretchSession(BoundaryStretchSession.none());
        if (!releasedSession.moved()) {
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.select(releasedSession.selection()));
        }
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.apply(releasedSession.preview()));
    }

    private static DungeonEditorMainViewInterpretation releaseDragSession(
            PointerState input,
            InteractionState state
    ) {
        if (input == null) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.clearPreviewIfNeeded(false));
        }
        DragSession releasedSession = state.dragSession();
        InteractionState nextState = state.withDragSession(DragSession.none());
        if (!releasedSession.moved()) {
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.clearPreviewIfNeeded(true));
        }
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.apply(releasedSession.moveHandlePreview()));
    }

}
