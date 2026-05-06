package src.domain.dungeoneditor.application;

import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewEffect;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;

final class InterpretDungeonEditorMainViewHoverUseCase {
    private final DungeonEditorBoundaryDraftUseCase boundaryDraft = new DungeonEditorBoundaryDraftUseCase();
    private final DungeonEditorCorridorInteractionUseCase corridor = new DungeonEditorCorridorInteractionUseCase();

    DungeonEditorMainViewEffect interpret(
            PointerState input,
            DungeonSnapshot snapshot,
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
