package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryStretchSession;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.DragSession;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.InteractionState;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PaintSession;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

final class InterpretDungeonEditorMainViewReleaseUseCase {
    private final DungeonEditorBoundaryDraftUseCase boundaryDraft = new DungeonEditorBoundaryDraftUseCase();

    DungeonEditorMainViewInterpretation interpretSelection(
            PointerState input,
            InteractionState state
    ) {
        if (state.boundaryStretchSession().present()) {
            return releaseBoundaryStretchSession(state);
        }
        if (!state.dragSession().present()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorSessionEffect.clearPreviewIfNeeded(false));
        }
        return releaseDragSession(input, state);
    }

    DungeonEditorRoomPaintInterpretation interpretRoomPaintOperation(
            PointerState input,
            InteractionState state
    ) {
        if (state.paintSession().present()) {
            return releasePaintSessionOperation(input, state);
        }
        return DungeonEditorRoomPaintInterpretation.from(
                new DungeonEditorMainViewInterpretation(state, DungeonEditorSessionEffect.clearPreviewIfNeeded(false)));
    }

    DungeonEditorMainViewInterpretation interpretBoundary(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool,
            InteractionState state
    ) {
        return boundaryDraft.release(input, snapshot, boundaryTool, state);
    }

    DungeonEditorWallBoundaryDraftInterpretation interpretWallBoundaryOperation(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool,
            InteractionState state
    ) {
        return boundaryDraft.releaseWall(input, snapshot, boundaryTool, state);
    }

    private static DungeonEditorRoomPaintInterpretation releasePaintSessionOperation(
            PointerState input,
            InteractionState state
    ) {
        PaintSession released = input == null
                ? state.paintSession()
                : state.paintSession().withEnd(input.q(), input.r());
        return new DungeonEditorRoomPaintInterpretation(
                state.withPaintSession(PaintSession.none()),
                DungeonEditorSessionEffect.apply(released.preview()),
                released);
    }

    private static DungeonEditorMainViewInterpretation releaseBoundaryStretchSession(InteractionState state) {
        BoundaryStretchSession releasedSession = state.boundaryStretchSession();
        InteractionState nextState = state.withBoundaryStretchSession(BoundaryStretchSession.none());
        if (!releasedSession.moved()) {
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.select(releasedSession.selection()));
        }
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.apply(releasedSession.preview()));
    }

    private static DungeonEditorMainViewInterpretation releaseDragSession(
            PointerState input,
            InteractionState state
    ) {
        if (input == null) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorSessionEffect.clearPreviewIfNeeded(false));
        }
        DragSession releasedSession = state.dragSession();
        InteractionState nextState = state.withDragSession(DragSession.none());
        if (!releasedSession.moved()) {
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.clearPreviewIfNeeded(true));
        }
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.apply(releasedSession.moveHandlePreview()));
    }

}
