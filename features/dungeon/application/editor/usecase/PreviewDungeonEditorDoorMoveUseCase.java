package features.dungeon.application.editor.usecase;

import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.structure.door.DoorBoundaryPreviewRelocation;
import features.dungeon.domain.core.structure.door.DoorBoundaryPreviewRelocation.DoorBoundaryPreviewPlan;
import features.dungeon.application.editor.interaction.DungeonEditorHandleType;
import features.dungeon.application.editor.session.DungeonEditorDungeonState;
import features.dungeon.application.editor.session.DungeonEditorSessionSnapshot;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Edge;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.HandleRef;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.application.editor.helper.PreviewDungeonEditorDoorBoundaryProjectionHelper;
import features.dungeon.application.editor.helper.PreviewDungeonEditorDoorHandleMoveHelper;
import features.dungeon.application.editor.helper.PreviewDungeonEditorDoorRoomCellsHelper;

final class PreviewDungeonEditorDoorMoveUseCase {
    private final DoorBoundaryPreviewRelocation relocation = new DoorBoundaryPreviewRelocation();
    private final PreviewDungeonEditorDoorBoundaryProjectionHelper boundaryProjection =
            new PreviewDungeonEditorDoorBoundaryProjectionHelper();
    private final PreviewDungeonEditorDoorHandleMoveHelper handleMove =
            new PreviewDungeonEditorDoorHandleMoveHelper();
    private final PreviewDungeonEditorDoorRoomCellsHelper roomCells =
            new PreviewDungeonEditorDoorRoomCellsHelper();

    DungeonEditorDungeonState.@Nullable PreviewFacts execute(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.MoveHandlePreview move)
                || move.handleRef().kind() != DungeonEditorHandleType.DOOR
                || surface == null) {
            return null;
        }
        MapSnapshot candidate = candidateMap(surface.map(), move);
        if (candidate == null || candidate.equals(surface.map())) {
            return null;
        }
        return new DungeonEditorDungeonState.PreviewFacts(
                new DungeonEditorDungeonState.SnapshotFacts(surface.mapName(), surface.revision(), candidate),
                "");
    }

    private @Nullable MapSnapshot candidateMap(
            MapSnapshot committed,
            DungeonEditorSessionValues.MoveHandlePreview preview
    ) {
        HandleRef handle = preview.handleRef();
        if (handle.sourceEdge() == null) {
            return null;
        }
        Edge sourceEdge = handle.sourceEdge();
        Edge movedEdge = handleMove.movedEdge(sourceEdge, preview.deltaQ(), preview.deltaR(), preview.deltaLevel());
        DoorBoundaryPreviewPlan plan = relocation.planDoorBoundaryMove(
                boundaryProjection.previewBoundaries(committed.boundaries()),
                roomCells.cellsByRoom(committed.areas()),
                boundaryProjection.coreEdge(sourceEdge),
                boundaryProjection.coreEdge(movedEdge),
                handle.topologyRef());
        if (plan == null) {
            return null;
        }
        return new MapSnapshot(
                committed.topology(),
                committed.width(),
                committed.height(),
                committed.areas(),
                boundaryProjection.movedBoundaries(committed.boundaries(), plan),
                committed.features(),
                handleMove.movedHandles(committed.editorHandles(), preview));
    }
}
