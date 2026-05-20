package src.domain.dungeon.model.editor.usecase;

import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.DragSession;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PaintSession;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInterpretation;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

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
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.clearPreviewIfNeeded(false));
        }
        DragSession nextDragSession = state.dragSession().withCurrentPointer(input.q(), input.r());
        InteractionState nextState = state.withDragSession(nextDragSession);
        DungeonEditorMainViewEffect effect = nextDragSession.moved()
                ? DungeonEditorMainViewEffect.preview(nextDragSession.moveHandlePreview())
                : DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
        return new DungeonEditorMainViewInterpretation(nextState, effect);
    }

    DungeonEditorMainViewInterpretation interpretBoundary(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool,
            InteractionState state
    ) {
        if (!input.primaryButtonDown()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.none());
        }
        return new DungeonEditorMainViewInterpretation(state, boundaryDraft.preview(input, snapshot, boundaryTool, state));
    }

    DungeonEditorMainViewInterpretation interpretRoom(
            PointerState input,
            InteractionState state
    ) {
        if (!input.primaryButtonDown()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.none());
        }
        if (!state.paintSession().present()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.clearPreviewIfNeeded(false));
        }
        PaintSession paintSession = state.paintSession().withEnd(input.q(), input.r());
        InteractionState nextState = state.withPaintSession(paintSession);
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.preview(paintSession.preview()));
    }

    private static DungeonEditorMainViewEffect previewFromStretch(
            src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryStretchSession stretchSession
    ) {
        if (!stretchSession.present() || !stretchSession.moved()) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
        }
        return DungeonEditorMainViewEffect.preview(stretchSession.preview());
    }

}
