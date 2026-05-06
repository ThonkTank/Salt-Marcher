package src.domain.dungeoneditor.application;

import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewEffect;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.DragSession;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInterpretation;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;

final class InterpretDungeonEditorMainViewScrollUseCase {

    DungeonEditorMainViewInterpretation interpret(
            int delta,
            DungeonEditorSessionValues.Tool selectedTool,
            int projectionLevel,
            DungeonSnapshot snapshot,
            InteractionState state
    ) {
        if (delta == 0 || state.boundaryStretchSession().present()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.none());
        }
        if (!state.dragSession().present() || !selectionToolSelected(selectedTool) || snapshot == null) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.projectionLevel(delta < 0 ? -1 : 1));
        }
        DragSession nextDragSession = state.dragSession().withCurrentLevel(projectionLevel + delta);
        InteractionState nextState = state.withDragSession(nextDragSession);
        DungeonEditorMainViewEffect effect = nextDragSession.moved()
                ? DungeonEditorMainViewEffect.preview(nextDragSession.moveHandlePreview())
                : DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
        return new DungeonEditorMainViewInterpretation(nextState, effect);
    }

    private static boolean selectionToolSelected(DungeonEditorSessionValues.Tool selectedTool) {
        return selectedTool != null && selectedTool.isSelectionTool();
    }
}
