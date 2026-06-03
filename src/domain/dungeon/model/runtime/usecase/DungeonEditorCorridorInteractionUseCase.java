package src.domain.dungeon.model.runtime.usecase;

import src.domain.dungeon.model.runtime.helper.DungeonEditorCorridorTargetHelper;
import src.domain.dungeon.model.runtime.helper.DungeonEditorCorridorFacingTargetHelper;
import src.domain.dungeon.model.runtime.helper.DungeonEditorCorridorRoutePreviewValidationHelper;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.CorridorDraft;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInterpretation;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.PendingCorridorTarget;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

final class DungeonEditorCorridorInteractionUseCase {
    private final DungeonEditorCorridorTargetHelper targetService = new DungeonEditorCorridorTargetHelper();
    private final DungeonEditorCorridorFacingTargetHelper facingTargetHelper =
            new DungeonEditorCorridorFacingTargetHelper();
    private final DungeonEditorCorridorRoutePreviewValidationHelper routeValidationHelper =
            new DungeonEditorCorridorRoutePreviewValidationHelper();

    DungeonEditorMainViewInterpretation press(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (selectedTool == DungeonEditorSessionValues.Tool.CORRIDOR_DELETE) {
            PendingCorridorTarget target = targetService.resolveDeleteTarget(input);
            InteractionState nextState = state.withCorridorDraft(CorridorDraft.none());
            DungeonEditorSessionValues.DeleteCorridorPreview preview = deletePreview(target);
            if (DungeonEditorWorkspaceValues.hasId(preview.corridorId())) {
                return new DungeonEditorMainViewInterpretation(
                        nextState,
                        DungeonEditorMainViewEffect.applyWithStatus(
                                preview,
                                ""));
            }
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.clearedSelection());
        }
        if (!input.primaryButtonDown()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.none());
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
        FacingTargets facingTargets = facingTargets(start, target, snapshot);
        if (!routeValidationHelper.hasValidRoute(snapshot, facingTargets.start(), facingTargets.target())) {
            return new DungeonEditorMainViewInterpretation(
                    nextState,
                    DungeonEditorMainViewEffect.select(facingTargets.target().selection(), "Korridorroute blockiert."));
        }
        return new DungeonEditorMainViewInterpretation(
                nextState,
                applyCorridorDraft(facingTargets.start(), facingTargets.target()));
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
            return DungeonEditorMainViewEffect.preview(deletePreview(target));
        }
        if (!state.corridorDraft().present()) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
        }
        PendingCorridorTarget start = state.corridorDraft().start();
        PendingCorridorTarget target = targetService.resolveCreateTarget(input, snapshot);
        if (target == null || start.targetKey().equals(target.targetKey()) || start.endpoint() == null || target.endpoint() == null) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
        }
        return createPreview(start, target, snapshot);
    }

    private static DungeonEditorMainViewEffect applyCorridorDraft(PendingCorridorTarget start, PendingCorridorTarget target) {
        if (start.endpoint() != null && target.endpoint() != null) {
            return DungeonEditorMainViewEffect.apply(
                    new DungeonEditorSessionValues.CorridorCreatePreview(start.endpoint(), target.endpoint()));
        }
        return DungeonEditorMainViewEffect.none();
    }

    private static DungeonEditorSessionValues.DeleteCorridorPreview deletePreview(PendingCorridorTarget target) {
        if (target == null) {
            return new DungeonEditorSessionValues.DeleteCorridorPreview(0L);
        }
        var handle = target.selection().handleRef();
        String targetKind = handle.topologyRef().present() || handle.corridorId() > 0L
                ? handle.kind().name()
                : "CORRIDOR";
        return new DungeonEditorSessionValues.DeleteCorridorPreview(
                target.deleteCorridorId(),
                targetKind,
                handle.topologyRef().id(),
                handle.roomId(),
                handle.index());
    }

    private DungeonEditorMainViewEffect createPreview(
            PendingCorridorTarget start,
            PendingCorridorTarget target,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot
    ) {
        FacingTargets facingTargets = facingTargets(start, target, snapshot);
        if (!routeValidationHelper.hasValidRoute(snapshot, facingTargets.start(), facingTargets.target())) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
        }
        return DungeonEditorMainViewEffect.preview(
                new DungeonEditorSessionValues.CorridorCreatePreview(
                        facingTargets.start().endpoint(),
                        facingTargets.target().endpoint()));
    }

    private FacingTargets facingTargets(
            PendingCorridorTarget start,
            PendingCorridorTarget target,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot
    ) {
        PendingCorridorTarget facedStart = facingTargetHelper.resolveFacingTarget(start, target, snapshot);
        PendingCorridorTarget facedTarget = facingTargetHelper.resolveFacingTarget(target, facedStart, snapshot);
        return new FacingTargets(
                facingTargetHelper.resolveFacingTarget(facedStart, facedTarget, snapshot),
                facedTarget);
    }

    private record FacingTargets(PendingCorridorTarget start, PendingCorridorTarget target) {
    }
}
