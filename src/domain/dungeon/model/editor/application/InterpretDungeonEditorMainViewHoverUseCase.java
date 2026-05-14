package src.domain.dungeon.model.editor.application;

import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

final class InterpretDungeonEditorMainViewHoverUseCase {
    private final DungeonEditorBoundaryDraftUseCase boundaryDraft = new DungeonEditorBoundaryDraftUseCase();
    private final DungeonEditorCorridorInteractionUseCase corridor = new DungeonEditorCorridorInteractionUseCase();

    DungeonEditorMainViewEffect interpret(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (input == null) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(state.boundaryDraft().present() || state.corridorDraft().present());
        }
        if (boundaryToolSelected(selectedTool)) {
            return boundaryDraft.preview(input, snapshot, selectedTool, state);
        }
        if (corridorToolSelected(selectedTool)) {
            return corridor.preview(input, snapshot, selectedTool, state);
        }
        return DungeonEditorMainViewEffect.clearPreviewIfNeeded(state.boundaryDraft().present() || state.corridorDraft().present());
    }

    private static boolean boundaryToolSelected(DungeonEditorSessionValues.Tool selectedTool) {
        return selectedTool != null && selectedTool.isBoundaryTool();
    }

    private static boolean corridorToolSelected(DungeonEditorSessionValues.Tool selectedTool) {
        return selectedTool != null && selectedTool.isCorridorTool();
    }
}
