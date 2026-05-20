package src.domain.dungeon.model.editor.usecase;

import src.domain.dungeon.model.editor.helper.DungeonEditorCorridorTargetHelper;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.CorridorDraft;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInterpretation;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PendingCorridorTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

final class DungeonEditorCorridorInteractionUseCase {
    private final DungeonEditorCorridorTargetHelper targetService = new DungeonEditorCorridorTargetHelper();

    DungeonEditorMainViewInterpretation press(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (!input.primaryButtonDown()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.none());
        }
        if (selectedTool == DungeonEditorSessionValues.Tool.CORRIDOR_DELETE) {
            PendingCorridorTarget target = targetService.resolveDeleteTarget(input);
            InteractionState nextState = state.withCorridorDraft(CorridorDraft.none());
            long corridorId = target == null ? 0L : target.deleteCorridorId();
            if (DungeonEditorWorkspaceValues.hasId(corridorId)) {
                return new DungeonEditorMainViewInterpretation(
                        nextState,
                        DungeonEditorMainViewEffect.applyWithStatus(
                                new DungeonEditorSessionValues.DeleteCorridorPreview(corridorId),
                                ""));
            }
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.clearedSelection());
        }
        PendingCorridorTarget target = targetService.resolveCreateTarget(input, snapshot);
        if (target == null) {
            return new DungeonEditorMainViewInterpretation(
                    state.withCorridorDraft(CorridorDraft.none()),
                    DungeonEditorMainViewEffect.clearedSelection());
        }
        if (!state.corridorDraft().present()) {
            InteractionState nextState = state.withCorridorDraft(CorridorDraft.start(target));
            return new DungeonEditorMainViewInterpretation(
                    nextState,
                    DungeonEditorMainViewEffect.select(
                            target.selection(),
                            "Start: " + target.displayLabel() + ". Zieltür oder Korridoranker anklicken."));
        }
        PendingCorridorTarget start = state.corridorDraft().start();
        InteractionState nextState = state.withCorridorDraft(CorridorDraft.none());
        if (start.targetKey().equals(target.targetKey())) {
            return new DungeonEditorMainViewInterpretation(
                    nextState,
                    DungeonEditorMainViewEffect.select(target.selection(), ""));
        }
        return new DungeonEditorMainViewInterpretation(nextState, applyCorridorDraft(start, target));
    }

    DungeonEditorMainViewEffect preview(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (selectedTool == DungeonEditorSessionValues.Tool.CORRIDOR_DELETE) {
            PendingCorridorTarget target = targetService.resolveDeleteTarget(input);
            if (target == null || !DungeonEditorWorkspaceValues.hasId(target.deleteCorridorId())) {
                return DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
            }
            return DungeonEditorMainViewEffect.preview(
                    new DungeonEditorSessionValues.DeleteCorridorPreview(target.deleteCorridorId()));
        }
        if (!state.corridorDraft().present()) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
        }
        PendingCorridorTarget start = state.corridorDraft().start();
        PendingCorridorTarget target = targetService.resolveCreateTarget(input, snapshot);
        if (target == null || start.targetKey().equals(target.targetKey()) || start.endpoint() == null || target.endpoint() == null) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
        }
        return DungeonEditorMainViewEffect.preview(
                new DungeonEditorSessionValues.CorridorCreatePreview(start.endpoint(), target.endpoint()));
    }

    private static DungeonEditorMainViewEffect applyCorridorDraft(PendingCorridorTarget start, PendingCorridorTarget target) {
        if (start.endpoint() != null && target.endpoint() != null) {
            return DungeonEditorMainViewEffect.apply(
                    new DungeonEditorSessionValues.CorridorCreatePreview(start.endpoint(), target.endpoint()));
        }
        return DungeonEditorMainViewEffect.none();
    }
}
