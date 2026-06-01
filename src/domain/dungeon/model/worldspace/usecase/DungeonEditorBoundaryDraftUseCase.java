package src.domain.dungeon.model.worldspace.usecase;

import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.worldspace.helper.DungeonEditorBoundaryClusterResolutionHelper;
import src.domain.dungeon.model.worldspace.helper.DungeonEditorBoundaryRoomTouchHelper;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInterpretation;
import src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues;

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

    DungeonEditorMainViewEffect preview(
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
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
        }
        long clusterId = clusterResolver.resolveBoundaryClusterId(snapshot, boundary);
        return DungeonEditorMainViewEffect.preview(new DungeonEditorSessionValues.ClusterBoundariesPreview(
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
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.clearPreviewIfNeeded(true));
        }
        BoundaryDraft draft = state.boundaryDraft();
        BoundaryTarget boundary = input.boundaryTarget();
        boolean deleteMode = selectedTool.deleteMode();
        long clusterId = clusterResolver.resolveBoundaryClusterId(snapshot, boundary);
        EdgeKey edge = EdgeKey.from(boundary.edgeRef());
        if (draft.deleteMode() != deleteMode
                || draft.clusterId() != clusterId
                || !draft.previewEdges().contains(edge)) {
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.clearPreviewIfNeeded(true));
        }
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.apply(
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
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.none());
        }
        BoundaryTarget boundary = input.boundaryTarget();
        boolean deleteMode = selectedTool.deleteMode();
        if (!roomTouchService.editableDoorBoundary(snapshot, boundary, deleteMode)) {
            return new DungeonEditorMainViewInterpretation(
                    state.withBoundaryDraft(BoundaryDraft.none()),
                    DungeonEditorMainViewEffect.clearPreviewIfNeeded(true));
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
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.preview(
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
