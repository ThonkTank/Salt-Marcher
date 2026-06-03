package src.domain.dungeon.model.worldspace.usecase;

import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.worldspace.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues;

final class InterpretDungeonEditorMainViewHoverUseCase {
    private final DungeonEditorBoundaryDraftUseCase boundaryDraft = new DungeonEditorBoundaryDraftUseCase();
    private final DungeonEditorCorridorInteractionUseCase corridor = new DungeonEditorCorridorInteractionUseCase();

    DungeonEditorMainViewEffect interpretSelection(InteractionState state) {
        return DungeonEditorMainViewEffect.clearPreviewIfNeeded(state.boundaryDraft().present() || state.corridorDraft().present());
    }

    DungeonEditorMainViewEffect interpretBoundary(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool,
            InteractionState state
    ) {
        if (input == null) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(state.boundaryDraft().present() || state.corridorDraft().present());
        }
        return boundaryDraft.preview(input, snapshot, boundaryTool, state);
    }

    DungeonEditorMainViewEffect interpretCorridor(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool corridorTool,
            InteractionState state
    ) {
        if (input == null) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(state.boundaryDraft().present() || state.corridorDraft().present());
        }
        return corridor.preview(input, snapshot, corridorTool, state);
    }
}
