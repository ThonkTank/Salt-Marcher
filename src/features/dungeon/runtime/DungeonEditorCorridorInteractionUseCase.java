package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.CorridorDraft;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.InteractionState;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PendingCorridorTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

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
            PendingCorridorTarget target = targetService.resolveDeleteTarget(input, snapshot);
            InteractionState nextState = state.withCorridorDraft(CorridorDraft.none());
            DungeonEditorSessionValues.DeleteCorridorPreview preview = deletePreview(target);
            if (DungeonEditorWorkspaceValues.hasId(preview.corridorId())) {
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
                    DungeonEditorSessionEffect.select(facingTargets.target().selection(), "Korridorroute blockiert."));
        }
        return new DungeonEditorMainViewInterpretation(
                nextState,
                applyCorridorDraft(facingTargets.start(), facingTargets.target()));
    }

    DungeonEditorSessionEffect preview(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (selectedTool == DungeonEditorSessionValues.Tool.CORRIDOR_DELETE) {
            PendingCorridorTarget target = targetService.resolveDeleteTarget(input, snapshot);
            if (target == null || !DungeonEditorWorkspaceValues.hasId(target.deleteCorridorId())) {
                return DungeonEditorSessionEffect.clearPreviewIfNeeded(true);
            }
            return DungeonEditorSessionEffect.preview(deletePreview(target));
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
