package features.dungeon.application.editor;

import features.dungeon.domain.core.structure.corridor.CorridorDeletionTarget;
import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.CorridorDraft;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.InteractionState;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PendingCorridorTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PointerState;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;

final class DungeonEditorCorridorInteractionUseCase {
    private final DungeonEditorCorridorTargetHelper targetService = new DungeonEditorCorridorTargetHelper();
    private final DungeonEditorCorridorFacingTargetHelper facingTargetHelper =
            new DungeonEditorCorridorFacingTargetHelper();
    private final DungeonEditorCorridorRoutePreviewValidationHelper routeValidationHelper =
            new DungeonEditorCorridorRoutePreviewValidationHelper();

    DungeonEditorMainViewInterpretation press(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorToolAction selectedTool,
            InteractionState state
    ) {
        if (selectedTool.deleteMode()) {
            PendingCorridorTarget target = targetService.resolveDeleteTarget(input, snapshot);
            InteractionState nextState = state.withCorridorDraft(CorridorDraft.none());
            DungeonEditorSessionValues.DeleteCorridorPreview preview = deletePreview(target);
            if (preview != null && DungeonEditorWorkspaceValues.hasId(preview.corridorId())) {
                return new DungeonEditorMainViewInterpretation(
                        nextState,
                        DungeonEditorSessionEffect.applyWithStatus(
                                preview,
                                ""));
            }
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.clearedSelection());
        }
        if (!input.primaryButtonDown()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorSessionEffect.none());
        }
        PendingCorridorTarget target = targetService.resolveCreateTarget(input, snapshot);
        if (target == null) {
            return new DungeonEditorMainViewInterpretation(
                    state.withCorridorDraft(CorridorDraft.none()),
                    DungeonEditorSessionEffect.clearedSelection());
        }
        if (!state.corridorDraft().present()) {
            InteractionState nextState = state.withCorridorDraft(CorridorDraft.start(target));
            return new DungeonEditorMainViewInterpretation(
                    nextState,
                    DungeonEditorSessionEffect.select(
                            target.selection(),
                            "Start: " + target.displayLabel() + ". Zieltür oder Korridoranker anklicken."));
        }
        PendingCorridorTarget start = state.corridorDraft().start();
        InteractionState nextState = state.withCorridorDraft(CorridorDraft.none());
        if (start.targetKey().equals(target.targetKey())) {
            return new DungeonEditorMainViewInterpretation(
                    nextState,
                    DungeonEditorSessionEffect.select(target.selection(), ""));
        }
        FacingTargets facingTargets = facingTargets(start, target, snapshot);
        if (!routeValidationHelper.hasValidRoute(snapshot, facingTargets.start(), facingTargets.target())) {
            return new DungeonEditorMainViewInterpretation(
                    nextState,
                    DungeonEditorSessionEffect.selectRejected(
                            facingTargets.target().selection(),
                            DungeonEditorCommandOutcome.RejectionReason.BLOCKED_ROUTE));
        }
        return new DungeonEditorMainViewInterpretation(
                nextState,
                applyCorridorDraft(facingTargets.start(), facingTargets.target()));
    }

    DungeonEditorSessionEffect preview(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorToolAction selectedTool,
            InteractionState state
    ) {
        if (selectedTool.deleteMode()) {
            PendingCorridorTarget target = targetService.resolveDeleteTarget(input, snapshot);
            DungeonEditorSessionValues.DeleteCorridorPreview preview = deletePreview(target);
            if (preview == null || !DungeonEditorWorkspaceValues.hasId(preview.corridorId())) {
                return DungeonEditorSessionEffect.clearPreviewIfNeeded(true);
            }
            return DungeonEditorSessionEffect.preview(preview);
        }
        if (!state.corridorDraft().present()) {
            return DungeonEditorSessionEffect.clearPreviewIfNeeded(true);
        }
        PendingCorridorTarget start = state.corridorDraft().start();
        PendingCorridorTarget target = targetService.resolveCreateTarget(input, snapshot);
        if (target == null || start.targetKey().equals(target.targetKey()) || start.endpoint() == null || target.endpoint() == null) {
            return DungeonEditorSessionEffect.clearPreviewIfNeeded(true);
        }
        return createPreview(start, target, snapshot);
    }

    private static DungeonEditorSessionEffect applyCorridorDraft(PendingCorridorTarget start, PendingCorridorTarget target) {
        if (start.endpoint() != null && target.endpoint() != null) {
            return DungeonEditorSessionEffect.apply(
                    new DungeonEditorSessionValues.CorridorCreatePreview(start.endpoint(), target.endpoint()));
        }
        return DungeonEditorSessionEffect.none();
    }

    private static DungeonEditorSessionValues.DeleteCorridorPreview deletePreview(PendingCorridorTarget target) {
        CorridorDeletionTarget deletionTarget = DungeonEditorCorridorDeletionTargets.deletionTarget(target);
        return deletionTarget == null ? null : new DungeonEditorSessionValues.DeleteCorridorPreview(deletionTarget);
    }

    private DungeonEditorSessionEffect createPreview(
            PendingCorridorTarget start,
            PendingCorridorTarget target,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot
    ) {
        FacingTargets facingTargets = facingTargets(start, target, snapshot);
        if (!routeValidationHelper.hasValidRoute(snapshot, facingTargets.start(), facingTargets.target())) {
            return DungeonEditorSessionEffect.clearPreviewIfNeeded(true);
        }
        return DungeonEditorSessionEffect.preview(
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
