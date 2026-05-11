package src.domain.dungeoneditor.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.DragSession;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInterpretation;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;

final class InterpretDungeonEditorMainViewScrollUseCase {

    DungeonEditorMainViewInterpretation interpret(
            int delta,
            DungeonEditorSessionValues.Tool selectedTool,
            int projectionLevel,
            @Nullable MapSnapshot snapshot,
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
