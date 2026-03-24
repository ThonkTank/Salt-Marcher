package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.corridor.DungeonCorridorEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonCorridorDraftState;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorSelectionState;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.List;
import java.util.Objects;

public final class CorridorInteractionController {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final EditorSelectionState selectionState;
    private final DungeonCorridorDraftState draftState;
    private final DungeonCorridorEditService corridorEditService;
    private final DungeonGridHitTester hitTester = new DungeonGridHitTester();

    public CorridorInteractionController(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            EditorSelectionState selectionState,
            DungeonCorridorDraftState draftState,
            DungeonCorridorEditService corridorEditService
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.selectionState = Objects.requireNonNull(selectionState, "selectionState");
        this.draftState = Objects.requireNonNull(draftState, "draftState");
        this.corridorEditService = Objects.requireNonNull(corridorEditService, "corridorEditService");
    }

    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        if (event == null || !event.isPrimaryButton()) {
            clear();
            return false;
        }
        return switch (sessionState.selectedTool()) {
            case CORRIDOR_CREATE -> handleCreatePressed(event);
            case CORRIDOR_DELETE -> handleDeletePressed(event);
            default -> false;
        };
    }

    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        return false;
    }

    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        return false;
    }

    public void clear() {
        draftState.clear();
    }

    private boolean handleCreatePressed(DungeonCanvasPointerEvent event) {
        DungeonLayout projected = projectedLayout();
        DungeonEditorHitTarget hit = hitTester.hitTest(
                projected,
                event.canvasPoint(),
                event.camera());
        DungeonCorridorDraftState.PendingTarget target = resolveTarget(hit, event.gridCell(), projected);
        if (target == null) {
            draftState.clear();
            selectionState.clearSelection();
            return false;
        }
        selectionState.selectTarget(target.targetKey());
        if (!draftState.hasPendingStart()) {
            draftState.selectPendingStart(target);
            return true;
        }
        if (Objects.equals(draftState.pendingStartTargetKey(), target.targetKey())) {
            draftState.clear();
            return true;
        }
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            draftState.clear();
            return true;
        }
        DungeonCorridorDraftState.PendingTarget start = draftState.pendingStart();
        draftState.clear();
        UiAsyncTasks.submitVoid(
                () -> applyCreateAction(mapId, start, target),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("CorridorInteractionController.handleCreatePressed()", throwable));
        return true;
    }

    private boolean handleDeletePressed(DungeonCanvasPointerEvent event) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || event.gridCell() == null) {
            return false;
        }
        DungeonLayout projected = projectedLayout();
        Corridor corridor = projected.corridorsAtCell(event.gridCell()).stream()
                .filter(candidate -> candidate != null && candidate.corridorId() != null)
                .findFirst()
                .orElse(null);
        if (corridor == null || corridor.corridorId() == null) {
            selectionState.clearSelection();
            return false;
        }
        selectionState.selectTarget(corridor.targetKey());
        draftState.clear();
        UiAsyncTasks.submitVoid(
                () -> corridorEditService.delete(corridor.corridorId()),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("CorridorInteractionController.handleDeletePressed()", throwable));
        return true;
    }

    private void applyCreateAction(
            long mapId,
            DungeonCorridorDraftState.PendingTarget start,
            DungeonCorridorDraftState.PendingTarget target
    ) throws Exception {
        DungeonLayout layout = mapState.activeMap();
        if (layout == null || layout.mapId() != mapId) {
            return;
        }
        if (start instanceof DungeonCorridorDraftState.PendingTarget.Room startRoom && target instanceof DungeonCorridorDraftState.PendingTarget.Room targetRoom) {
            corridorEditService.create(layout, List.of(startRoom.roomId(), targetRoom.roomId()));
            return;
        }
        if (start instanceof DungeonCorridorDraftState.PendingTarget.Room startRoom && target instanceof DungeonCorridorDraftState.PendingTarget.Corridor targetCorridor) {
            corridorEditService.addRoom(layout, targetCorridor.corridorId(), startRoom.roomId());
            return;
        }
        if (start instanceof DungeonCorridorDraftState.PendingTarget.Corridor startCorridor && target instanceof DungeonCorridorDraftState.PendingTarget.Room targetRoom) {
            corridorEditService.addRoom(layout, startCorridor.corridorId(), targetRoom.roomId());
            return;
        }
        if (start instanceof DungeonCorridorDraftState.PendingTarget.Corridor startCorridor
                && target instanceof DungeonCorridorDraftState.PendingTarget.Corridor targetCorridor) {
            corridorEditService.merge(layout, targetCorridor.corridorId(), startCorridor.corridorId());
        }
    }

    private DungeonLayout projectedLayout() {
        DungeonLayout layout = mapState.activeMap();
        if (layout == null) {
            return DungeonLayout.empty();
        }
        return layout.projectedToLevel(mapState.activeProjectionLevel());
    }

    private static DungeonCorridorDraftState.PendingTarget resolveTarget(DungeonEditorHitTarget hit, features.world.dungeonmap.model.geometry.Point2i gridCell, DungeonLayout layout) {
        Long roomId = singleRoomIdFor(hit, layout);
        if (roomId != null && hit != null) {
            return new DungeonCorridorDraftState.PendingTarget.Room(roomId, hit.targetKey());
        }
        if (layout == null || gridCell == null) {
            return null;
        }
        Corridor corridor = layout.corridorsAtCell(gridCell).stream()
                .filter(candidate -> candidate != null && candidate.corridorId() != null)
                .findFirst()
                .orElse(null);
        return corridor == null ? null : new DungeonCorridorDraftState.PendingTarget.Corridor(corridor.corridorId(), corridor.targetKey());
    }

    private static Long singleRoomIdFor(DungeonEditorHitTarget hit, DungeonLayout layout) {
        if (hit == null || layout == null) {
            return null;
        }
        if (hit.roomId() != null) {
            return hit.roomId();
        }
        if (hit.clusterId() == null) {
            return null;
        }
        RoomCluster cluster = layout.findCluster(hit.clusterId());
        return cluster == null || cluster.singleRoom() == null ? null : cluster.singleRoom().roomId();
    }
}
