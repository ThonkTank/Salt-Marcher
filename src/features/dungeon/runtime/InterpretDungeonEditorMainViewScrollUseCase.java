package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.DragSession;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.InteractionState;

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
