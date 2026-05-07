package src.domain.dungeoneditor.application;

import src.domain.dungeoneditor.interaction.service.DungeonEditorCorridorTargetService;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewEffect;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.CorridorDraft;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInterpretation;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PendingCorridorTarget;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

final class DungeonEditorCorridorInteractionUseCase {
    private final DungeonEditorCorridorTargetService targetService = new DungeonEditorCorridorTargetService();

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
                                new DungeonEditorSessionValues.CorridorDeletePreview(corridorId),
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
                    new DungeonEditorSessionValues.CorridorDeletePreview(target.deleteCorridorId()));
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
