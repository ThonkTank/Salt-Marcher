package features.dungeon.application.editor;

import java.util.List;
import java.util.Set;
import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.EdgeKey;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.InteractionState;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorBoundaryDraftUseCase {
    private final DungeonEditorWallBoundaryDraftUseCase wallDraft = new DungeonEditorWallBoundaryDraftUseCase();
    private final DungeonEditorBoundaryClusterResolutionHelper clusterResolver = new DungeonEditorBoundaryClusterResolutionHelper();
    private final DungeonEditorBoundaryRoomTouchHelper roomTouchService = new DungeonEditorBoundaryRoomTouchHelper();

    DungeonEditorWallBoundaryDraftInterpretation pressWall(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection,
            DungeonEditorToolAction selectedTool,
            InteractionState state
    ) {
        return wallDraft.pressOperation(input, snapshot, currentSelection, selectedTool, state);
    }

    DungeonEditorDoorBoundaryDraftInterpretation pressDoor(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorToolAction selectedTool,
            InteractionState state
    ) {
        return DungeonEditorDoorBoundaryDraftInterpretation.from(armDoorBoundary(
                input,
                snapshot,
                selectedTool,
                state));
    }

    DungeonEditorSessionEffect preview(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorToolAction selectedTool,
            InteractionState state
    ) {
        if (!selectedTool.isDoorAction()) {
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
                features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind.DOOR,
                deleteMode));
    }

    DungeonEditorWallBoundaryDraftInterpretation releaseWall(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorToolAction selectedTool,
            InteractionState state
    ) {
        return wallDraft.releaseOperation(input, snapshot, selectedTool, state);
    }

    DungeonEditorDoorBoundaryDraftInterpretation releaseDoor(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorToolAction selectedTool,
            InteractionState state
    ) {
        InteractionState nextState = state.withBoundaryDraft(BoundaryDraft.none());
        if (!selectedTool.isDoorAction() || !state.boundaryDraft().present() || input == null) {
            return new DungeonEditorDoorBoundaryDraftInterpretation(
                    nextState,
                    DungeonEditorSessionEffect.clearPreviewIfNeeded(true),
                    null);
        }
        BoundaryDraft draft = state.boundaryDraft();
        BoundaryTarget boundary = input.boundaryTarget();
        boolean deleteMode = selectedTool.deleteMode();
        long clusterId = clusterResolver.resolveBoundaryClusterId(snapshot, boundary);
        EdgeKey edge = EdgeKey.from(boundary.edgeRef());
        if (draft.deleteMode() != deleteMode
                || draft.clusterId() != clusterId
                || !draft.previewEdges().contains(edge)) {
            return new DungeonEditorDoorBoundaryDraftInterpretation(
                    nextState,
                    DungeonEditorSessionEffect.clearPreviewIfNeeded(true),
                    null);
        }
        DungeonEditorSessionValues.ClusterBoundariesPreview preview =
                new DungeonEditorSessionValues.ClusterBoundariesPreview(
                        clusterId,
                        List.of(edge.toEdgeRef()),
                        features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind.DOOR,
                        deleteMode);
        return new DungeonEditorDoorBoundaryDraftInterpretation(
                nextState,
                DungeonEditorSessionEffect.apply(preview),
                new DungeonEditorDoorBoundaryDraftInterpretation.DoorBoundaryCommit(
                        clusterId,
                        edge,
                        deleteMode));
    }

    private DungeonEditorMainViewInterpretation armDoorBoundary(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorToolAction selectedTool,
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
                        features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind.DOOR,
                deleteMode)));
    }

    private static boolean doorBoundaryPressMatchesTool(
            PointerState input,
            DungeonEditorToolAction selectedTool
    ) {
        return selectedTool.deleteMode() ? input.secondaryButtonDown() : input.primaryButtonDown();
    }
}
