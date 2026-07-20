package features.dungeon.application.editor;

import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.DragSession;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.InteractionState;

final class InterpretDungeonEditorMainViewScrollUseCase {

    DungeonEditorMainViewInterpretation interpretSelection(
            int delta,
            int projectionLevel,
            @Nullable MapSnapshot snapshot,
            InteractionState state
    ) {
        if (delta == 0 || state.boundaryStretchSession().present()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorSessionEffect.none());
        }
        if (!state.dragSession().present() || snapshot == null) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorSessionEffect.projectionLevel(delta < 0 ? -1 : 1));
        }
        DragSession nextDragSession = state.dragSession().withCurrentLevel(projectionLevel + delta);
        InteractionState nextState = state.withDragSession(nextDragSession);
        DungeonEditorSessionEffect effect = nextDragSession.moved()
                ? DungeonEditorSessionEffect.preview(nextDragSession.moveHandlePreview())
                : DungeonEditorSessionEffect.clearPreviewIfNeeded(true);
        return new DungeonEditorMainViewInterpretation(nextState, effect);
    }
}
