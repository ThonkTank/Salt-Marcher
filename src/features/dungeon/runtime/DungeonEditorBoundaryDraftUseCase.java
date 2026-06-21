package src.features.dungeon.runtime;

import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.InteractionState;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorBoundaryDraftUseCase {
    private final DungeonEditorWallBoundaryDraftUseCase wallDraft = new DungeonEditorWallBoundaryDraftUseCase();
    private final DungeonEditorBoundaryClusterResolutionHelper clusterResolver = new DungeonEditorBoundaryClusterResolutionHelper();
    private final DungeonEditorBoundaryRoomTouchHelper roomTouchService = new DungeonEditorBoundaryRoomTouchHelper();

    DungeonEditorMainViewInterpretation press(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (!selectedTool.isDoorTool()) {
            return wallDraft.press(input, snapshot, currentSelection, selectedTool, state);
        }
        return armDoorBoundary(input, snapshot, selectedTool, state);
    }

    DungeonEditorSessionEffect preview(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (!selectedTool.isDoorTool()) {
            return wallDraft.preview(input, snapshot, selectedTool, state);
        }
        BoundaryTarget boundary = input.boundaryTarget();
        boolean deleteMode = selectedTool.deleteMode();
        if (!roomTouchService.editableDoorBoundary(snapshot, boundary, deleteMode)) {
            return DungeonEditorSessionEffect.clearPreviewIfNeeded(true);
        }
        long clusterId = clusterResolver.resolveBoundaryClusterId(snapshot, boundary);
        return DungeonEditorSessionEffect.preview(new DungeonEditorSessionValues.ClusterBoundariesPreview(
                clusterId,
                List.of(boundary.edgeRef()),
                DungeonEditorWorkspaceValues.BoundaryKind.DOOR,
                deleteMode));
    }

    DungeonEditorMainViewInterpretation release(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (!selectedTool.isDoorTool()) {
            return wallDraft.release(input, snapshot, selectedTool, state);
        }
        InteractionState nextState = state.withBoundaryDraft(BoundaryDraft.none());
        if (!state.boundaryDraft().present() || input == null) {
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.clearPreviewIfNeeded(true));
        }
        BoundaryDraft draft = state.boundaryDraft();
        BoundaryTarget boundary = input.boundaryTarget();
        boolean deleteMode = selectedTool.deleteMode();
        long clusterId = clusterResolver.resolveBoundaryClusterId(snapshot, boundary);
        EdgeKey edge = EdgeKey.from(boundary.edgeRef());
        if (draft.deleteMode() != deleteMode
                || draft.clusterId() != clusterId
                || !draft.previewEdges().contains(edge)) {
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.clearPreviewIfNeeded(true));
        }
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.apply(
                new DungeonEditorSessionValues.ClusterBoundariesPreview(
                        clusterId,
                        List.of(edge.toEdgeRef()),
                        DungeonEditorWorkspaceValues.BoundaryKind.DOOR,
                        deleteMode)));
    }

    private DungeonEditorMainViewInterpretation armDoorBoundary(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (input == null || !doorBoundaryPressMatchesTool(input, selectedTool)) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorSessionEffect.none());
        }
        BoundaryTarget boundary = input.boundaryTarget();
        boolean deleteMode = selectedTool.deleteMode();
        if (!roomTouchService.editableDoorBoundary(snapshot, boundary, deleteMode)) {
            return new DungeonEditorMainViewInterpretation(
                    state.withBoundaryDraft(BoundaryDraft.none()),
                    DungeonEditorSessionEffect.clearPreviewIfNeeded(true));
        }
        long clusterId = clusterResolver.resolveBoundaryClusterId(snapshot, boundary);
        EdgeKey edge = EdgeKey.from(boundary.edgeRef());
        InteractionState nextState = state.withBoundaryDraft(new BoundaryDraft(
                clusterId,
                deleteMode,
                edge.start(),
                edge.end(),
                Set.of(edge),
                true));
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.preview(
                new DungeonEditorSessionValues.ClusterBoundariesPreview(
                        clusterId,
                        List.of(boundary.edgeRef()),
                        DungeonEditorWorkspaceValues.BoundaryKind.DOOR,
                deleteMode)));
    }

    private static boolean doorBoundaryPressMatchesTool(
            PointerState input,
            DungeonEditorSessionValues.Tool selectedTool
    ) {
        return selectedTool.deleteMode() ? input.secondaryButtonDown() : input.primaryButtonDown();
    }
}
