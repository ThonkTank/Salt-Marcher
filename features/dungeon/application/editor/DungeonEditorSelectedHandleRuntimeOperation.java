package features.dungeon.application.editor;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.DungeonEditorRuntimeApplicationService;
import features.dungeon.application.editor.interaction.DungeonEditorHandleType;
import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.application.editor.helper.DungeonEditorSessionPreviewHelper;

final class DungeonEditorSelectedHandleRuntimeOperation {
    private final DungeonEditorRuntimeContext context;

    DungeonEditorSelectedHandleRuntimeOperation(DungeonEditorRuntimeContext context) {
        this.context = Objects.requireNonNull(context, "context");
    }

    DungeonEditorRuntimeContext.Result apply(
            PointerAction action,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        PointerAction effectiveAction = PointerAction.orMoved(action);
        if (effectiveAction.pressed()) {
            return press(input);
        } else if (effectiveAction.dragged()) {
            return drag(input);
        } else if (effectiveAction.released()) {
            return release(input);
        } else if (effectiveAction.moved()) {
            return hover(input);
        } else {
            throw new IllegalStateException("Unsupported selected-handle action: " + effectiveAction);
        }
    }

    DungeonEditorRuntimeContext.Result scroll(int projectionLevelDelta) {
        return context.applyEffect(context.scrollSelection(projectionLevelDelta), null);
    }

    DungeonEditorRuntimeContext.Result moveCorridorPoint(
            DungeonEditorWorkspaceValues.HandleRef handle,
            int q,
            int r
    ) {
        DungeonEditorWorkspaceValues.HandleRef handleRef = handle == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : handle;
        if (!DungeonEditorSessionPreviewHelper.directCorridorMoveCommitHandle(handleRef.kind())
                || !context.hasSelectedMap()) {
            return DungeonEditorRuntimeContext.Result.none();
        }
        DungeonEditorWorkspaceValues.Cell sourceCell = handleRef.cell();
        int deltaQ = q - sourceCell.q();
        int deltaR = r - sourceCell.r();
        if (deltaQ == 0 && deltaR == 0) {
            return DungeonEditorRuntimeContext.Result.none();
        }
        DungeonEditorSessionValues.MoveHandlePreview preview = new DungeonEditorSessionValues.MoveHandlePreview(
                handleRef,
                deltaQ,
                deltaR,
                0);
        DungeonEditorWorkspaceValues.MapId selectedMapId = context.selectedMapId();
        if (selectedMapId == null) {
            return DungeonEditorRuntimeContext.Result.none();
        }
        context.moveCorridorHandle(selectedMapId, preview);
        context.clearPreviewWithStatus(context.currentFacts().mutationStatusText());
        return context.publishCurrent();
    }

    private DungeonEditorRuntimeContext.Result press(DungeonEditorMainViewInput input) {
        DungeonEditorRuntimeApplicationService.CurrentGridPublication currentGrid =
                context.currentGridOrPublishCurrentResult();
        MapSnapshot committedSnapshot = currentGrid.committedSnapshot();
        if (committedSnapshot == null) {
            return context.fromSnapshot(currentGrid.snapshot());
        }
        DungeonEditorSessionEffect effect = context.selection(
                InterpretDungeonEditorMainViewInputUseCase.PointerAction.PRESS,
                input,
                committedSnapshot);
        return context.fromPublication(
                currentGrid.snapshot(),
                context.applyEffectPublication(effect, null));
    }

    private DungeonEditorRuntimeContext.Result drag(DungeonEditorMainViewInput input) {
        DungeonEditorRuntimeApplicationService.CurrentGridPublication currentGrid =
                context.currentGridOrPublishCurrentResult();
        if (currentGrid.committedSnapshot() == null) {
            return context.fromSnapshot(currentGrid.snapshot());
        }
        DungeonEditorSessionEffect effect = context.selection(
                InterpretDungeonEditorMainViewInputUseCase.PointerAction.DRAG,
                input,
                null);
        return context.fromPublication(
                currentGrid.snapshot(),
                context.applyEffectPublication(effect, null));
    }

    private DungeonEditorRuntimeContext.Result release(DungeonEditorMainViewInput input) {
        DungeonEditorRuntimeApplicationService.CurrentGridPublication currentGrid =
                context.currentGridOrPublishCurrentResult();
        if (currentGrid.committedSnapshot() == null) {
            return context.fromSnapshot(currentGrid.snapshot());
        }
        DungeonEditorSessionEffect effect = context.selection(
                InterpretDungeonEditorMainViewInputUseCase.PointerAction.RELEASE,
                input,
                null);
        return context.fromPublication(
                currentGrid.snapshot(),
                context.applyEffectPublication(effect, commitFor(effect.getApplyPreview())));
    }

    private DungeonEditorRuntimeContext.Result hover(DungeonEditorMainViewInput input) {
        return context.applyEffect(context.selection(
                InterpretDungeonEditorMainViewInputUseCase.PointerAction.HOVER,
                input,
                null), null);
    }

    private DungeonEditorRuntimeApplicationService.@Nullable AuthoredCommit commitFor(
            DungeonEditorSessionValues.@Nullable Preview preview
    ) {
        if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview move) {
            return moveHandleCommitFor(move);
        }
        if (preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch) {
            return mapId -> context.stretchClusterBoundary(mapId, stretch);
        }
        return null;
    }

    private DungeonEditorRuntimeApplicationService.@Nullable AuthoredCommit moveHandleCommitFor(
            DungeonEditorSessionValues.MoveHandlePreview move
    ) {
        if (DungeonEditorSessionPreviewHelper.directClusterMoveCommitHandle(move.handleRef().kind())) {
            return mapId -> context.moveClusterHandle(mapId, move);
        }
        if (DungeonEditorSessionPreviewHelper.directDoorMoveCommitHandle(move.handleRef().kind())) {
            return mapId -> context.moveDoorHandle(mapId, move);
        }
        if (DungeonEditorSessionPreviewHelper.directCorridorMoveCommitHandle(move.handleRef().kind())) {
            return mapId -> context.moveCorridorHandle(mapId, move);
        }
        if (move.handleRef().kind() == DungeonEditorHandleType.STAIR_ANCHOR) {
            return mapId -> context.moveStairHandle(mapId, move);
        }
        return null;
    }
}
