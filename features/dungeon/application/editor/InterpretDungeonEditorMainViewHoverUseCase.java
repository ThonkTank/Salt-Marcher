package features.dungeon.application.editor;

import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.InteractionState;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PointerState;

final class InterpretDungeonEditorMainViewHoverUseCase {
    private final DungeonEditorBoundaryDraftUseCase boundaryDraft = new DungeonEditorBoundaryDraftUseCase();
    private final DungeonEditorCorridorInteractionUseCase corridor;

    InterpretDungeonEditorMainViewHoverUseCase(
            features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy routingPolicy
    ) {
        corridor = new DungeonEditorCorridorInteractionUseCase(routingPolicy);
    }

    DungeonEditorSessionEffect interpretSelection(InteractionState state) {
        return DungeonEditorSessionEffect.clearPreviewIfNeeded(state.boundaryDraft().present() || state.corridorDraft().present());
    }

    DungeonEditorSessionEffect interpretBoundary(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorToolAction boundaryTool,
            InteractionState state
    ) {
        if (input == null) {
            return DungeonEditorSessionEffect.clearPreviewIfNeeded(state.boundaryDraft().present() || state.corridorDraft().present());
        }
        return boundaryDraft.preview(input, snapshot, boundaryTool, state);
    }

    DungeonEditorSessionEffect interpretCorridor(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorToolAction corridorTool,
            InteractionState state
    ) {
        if (input == null) {
            return DungeonEditorSessionEffect.clearPreviewIfNeeded(state.boundaryDraft().present() || state.corridorDraft().present());
        }
        return corridor.preview(input, snapshot, corridorTool, state);
    }
}
