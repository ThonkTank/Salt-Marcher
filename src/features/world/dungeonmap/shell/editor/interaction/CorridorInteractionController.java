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

    private sealed interface CorridorEndpoint permits CorridorEndpoint.Room, CorridorEndpoint.Corridor {
        String targetKey();

        record Room(Long roomId, String targetKey) implements CorridorEndpoint {
        }

        record Corridor(Long corridorId, String targetKey) implements CorridorEndpoint {
        }
    }

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final EditorSelectionState selectionState;
    private final DungeonCorridorDraftState draftState;
    private final DungeonCorridorEditService corridorEditService;
    private final DungeonEditorHitTester hitTester = new DungeonGridHitTester();

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
        DungeonEditorHitTarget hit = hitTester.hitTest(
                mapState.activeMap(),
                event.canvasPoint(),
                event.camera());
        CorridorEndpoint endpoint = resolveEndpoint(hit, event.gridCell(), mapState.activeMap());
        if (endpoint == null) {
            draftState.clear();
            selectionState.clearSelection();
            return false;
        }
        selectionState.selectTarget(endpoint.targetKey());
        if (!draftState.hasPendingStart()) {
            draftState.selectPendingStart(toPendingTarget(endpoint));
            return true;
        }
        if (Objects.equals(draftState.pendingStartTargetKey(), endpoint.targetKey())) {
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
                () -> applyCreateAction(mapId, start, endpoint),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("CorridorInteractionController.handleCreatePressed()", throwable));
        return true;
    }

    private boolean handleDeletePressed(DungeonCanvasPointerEvent event) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || event.gridCell() == null) {
            return false;
        }
        Corridor corridor = mapState.activeMap().corridorsAtCell(event.gridCell()).stream()
                .filter(candidate -> candidate != null && candidate.corridorId() != null)
                .findFirst()
                .orElse(null);
        if (corridor == null || corridor.corridorId() == null) {
            selectionState.clearSelection();
            return false;
        }
        selectionState.selectTarget("corridor:" + corridor.corridorId());
        draftState.clear();
        UiAsyncTasks.submitVoid(
                () -> corridorEditService.delete(mapId, corridor.corridorId()),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("CorridorInteractionController.handleDeletePressed()", throwable));
        return true;
    }

    private void applyCreateAction(
            long mapId,
            DungeonCorridorDraftState.PendingTarget start,
            CorridorEndpoint target
    ) throws Exception {
        if (start instanceof DungeonCorridorDraftState.PendingTarget.Room startRoom && target instanceof CorridorEndpoint.Room targetRoom) {
            corridorEditService.create(mapId, List.of(startRoom.roomId(), targetRoom.roomId()));
            return;
        }
        if (start instanceof DungeonCorridorDraftState.PendingTarget.Room startRoom && target instanceof CorridorEndpoint.Corridor targetCorridor) {
            corridorEditService.addRoom(mapId, targetCorridor.corridorId(), startRoom.roomId());
            return;
        }
        if (start instanceof DungeonCorridorDraftState.PendingTarget.Corridor startCorridor && target instanceof CorridorEndpoint.Room targetRoom) {
            corridorEditService.addRoom(mapId, startCorridor.corridorId(), targetRoom.roomId());
            return;
        }
        if (start instanceof DungeonCorridorDraftState.PendingTarget.Corridor startCorridor
                && target instanceof CorridorEndpoint.Corridor targetCorridor) {
            corridorEditService.merge(mapId, targetCorridor.corridorId(), startCorridor.corridorId());
        }
    }

    private static DungeonCorridorDraftState.PendingTarget toPendingTarget(CorridorEndpoint endpoint) {
        if (endpoint instanceof CorridorEndpoint.Room room) {
            return new DungeonCorridorDraftState.PendingTarget.Room(room.roomId(), room.targetKey());
        }
        if (endpoint instanceof CorridorEndpoint.Corridor corridor) {
            return new DungeonCorridorDraftState.PendingTarget.Corridor(corridor.corridorId(), corridor.targetKey());
        }
        return null;
    }

    private static CorridorEndpoint resolveEndpoint(DungeonEditorHitTarget hit, features.world.dungeonmap.model.geometry.Point2i gridCell, DungeonLayout layout) {
        Long roomId = singleRoomIdFor(hit, layout);
        if (roomId != null && hit != null) {
            return new CorridorEndpoint.Room(roomId, hit.targetKey());
        }
        if (layout == null || gridCell == null) {
            return null;
        }
        Corridor corridor = layout.corridorsAtCell(gridCell).stream()
                .filter(candidate -> candidate != null && candidate.corridorId() != null)
                .findFirst()
                .orElse(null);
        return corridor == null ? null : new CorridorEndpoint.Corridor(corridor.corridorId(), "corridor:" + corridor.corridorId());
    }

    private static Long singleRoomIdFor(DungeonEditorHitTarget hit, DungeonLayout layout) {
        if (hit == null || layout == null) {
            return null;
        }
        if (!(hit.targetRef() instanceof DungeonEditorTargetRef.ClusterRef clusterRef) || clusterRef.clusterId() == null) {
            return null;
        }
        RoomCluster cluster = layout.findCluster(clusterRef.clusterId());
        return cluster == null || cluster.singleRoom() == null ? null : cluster.singleRoom().roomId();
    }
}
