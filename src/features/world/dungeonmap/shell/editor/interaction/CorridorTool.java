package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.corridor.DungeonCorridorEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorDraft;
import features.world.dungeonmap.state.EditorInteractionState;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class CorridorTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final DungeonCorridorEditService corridorEditService;
    private final EditorInteractionState state;
    private final DungeonGridHitTester hitTester = new DungeonGridHitTester();
    private final Label statusLabel = new Label("Kein Korridor gewählt");
    private final VBox statusCard = EditorCards.card("Korridor", statusLabel);

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };

    public CorridorTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            DungeonCorridorEditService corridorEditService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.corridorEditService = Objects.requireNonNull(corridorEditService, "corridorEditService");
        this.state = Objects.requireNonNull(state, "state");
        this.statusLabel.setWrapText(true);
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.CORRIDOR_CREATE, DungeonEditorTool.CORRIDOR_DELETE);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
        refreshStatePane();
    }

    @Override
    public void deactivate() {
        activeTool = null;
        clear();
        refreshStatePane();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null || !event.isPrimaryButton()) {
            clear();
            return false;
        }
        return switch (sessionState.selectedTool()) {
            case CORRIDOR_CREATE -> handleCreatePressed(ctx, event);
            case CORRIDOR_DELETE -> handleDeletePressed(ctx, event);
            default -> false;
        };
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        return false;
    }

    @Override
    public Node statePaneContent() {
        String statusText = corridorStatusText();
        if (statusText == null || statusText.isBlank()) {
            statusLabel.setText("Kein Korridor gewählt");
            return null;
        }
        statusLabel.setText(statusText);
        return statusCard;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
    }

    private boolean handleCreatePressed(EditorToolContext ctx, DungeonCanvasPointerEvent event) {
        DungeonLayout projected = projectedLayout(ctx);
        DungeonEditorHitTarget hit = hitTester.hitTest(projected, event.canvasPoint(), event.camera());
        EditorDraft.PendingTarget target = resolveTarget(hit, event.gridCell(), projected);
        if (target == null) {
            clear();
            state.clearSelection();
            return false;
        }
        state.selectTarget(target.targetKey());
        EditorDraft.CorridorDraft draft = corridorDraft();
        if (draft == null || draft.pendingStart() == null) {
            state.showDraft(new EditorDraft.CorridorDraft(
                    new EditorDraft.PendingStart(
                            target,
                            mapState.activeProjectionLevel(),
                            displayLabel(target, mapState.activeMap()))));
            refreshStatePane();
            return true;
        }
        if (Objects.equals(draft.pendingStart().target().targetKey(), target.targetKey())) {
            clear();
            return true;
        }
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            clear();
            return true;
        }
        EditorDraft.PendingStart start = draft.pendingStart();
        clear();
        UiAsyncTasks.submitVoid(
                () -> applyCreateAction(mapId, start.target(), target),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("CorridorTool.handleCreatePressed()", throwable));
        return true;
    }

    private boolean handleDeletePressed(EditorToolContext ctx, DungeonCanvasPointerEvent event) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || event.gridCell() == null) {
            return false;
        }
        DungeonLayout projected = projectedLayout(ctx);
        Corridor corridor = projected.corridorsAtCell(event.gridCell()).stream()
                .filter(candidate -> candidate != null && candidate.corridorId() != null)
                .findFirst()
                .orElse(null);
        if (corridor == null || corridor.corridorId() == null) {
            state.clearSelection();
            return false;
        }
        state.selectTarget(corridor.targetKey());
        clear();
        UiAsyncTasks.submitVoid(
                () -> corridorEditService.delete(corridor.corridorId()),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("CorridorTool.handleDeletePressed()", throwable));
        return true;
    }

    private void applyCreateAction(
            long mapId,
            EditorDraft.PendingTarget start,
            EditorDraft.PendingTarget target
    ) throws Exception {
        DungeonLayout layout = mapState.activeMap();
        if (layout == null || layout.mapId() != mapId) {
            return;
        }
        if (start instanceof EditorDraft.PendingTarget.Room startRoom && target instanceof EditorDraft.PendingTarget.Room targetRoom) {
            corridorEditService.create(layout, List.of(startRoom.roomId(), targetRoom.roomId()));
            return;
        }
        if (start instanceof EditorDraft.PendingTarget.Room startRoom && target instanceof EditorDraft.PendingTarget.Corridor targetCorridor) {
            corridorEditService.addRoom(layout, targetCorridor.corridorId(), startRoom.roomId());
            return;
        }
        if (start instanceof EditorDraft.PendingTarget.Corridor startCorridor && target instanceof EditorDraft.PendingTarget.Room targetRoom) {
            corridorEditService.addRoom(layout, startCorridor.corridorId(), targetRoom.roomId());
            return;
        }
        if (start instanceof EditorDraft.PendingTarget.Corridor startCorridor
                && target instanceof EditorDraft.PendingTarget.Corridor targetCorridor) {
            corridorEditService.merge(layout, targetCorridor.corridorId(), startCorridor.corridorId());
        }
    }

    private static String displayLabel(EditorDraft.PendingTarget target, DungeonLayout layout) {
        if (target instanceof EditorDraft.PendingTarget.Room roomTarget) {
            Room room = layout == null ? null : layout.findRoom(roomTarget.roomId());
            if (room != null && room.name() != null && !room.name().isBlank()) {
                return room.name();
            }
            return roomTarget.roomId() == null ? "Raum" : "Raum " + roomTarget.roomId();
        }
        if (target instanceof EditorDraft.PendingTarget.Corridor corridorTarget) {
            return corridorTarget.corridorId() == null ? "Korridor" : "Korridor " + corridorTarget.corridorId();
        }
        return "Ziel";
    }

    private static EditorDraft.PendingTarget resolveTarget(
            DungeonEditorHitTarget hit,
            features.world.dungeonmap.model.geometry.Point2i gridCell,
            DungeonLayout layout
    ) {
        Long roomId = singleRoomIdFor(hit, layout);
        if (roomId != null && hit != null) {
            return new EditorDraft.PendingTarget.Room(roomId, hit.targetKey());
        }
        if (layout == null || gridCell == null) {
            return null;
        }
        Corridor corridor = layout.corridorsAtCell(gridCell).stream()
                .filter(candidate -> candidate != null && candidate.corridorId() != null)
                .findFirst()
                .orElse(null);
        return corridor == null ? null : new EditorDraft.PendingTarget.Corridor(corridor.corridorId(), corridor.targetKey());
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

    private DungeonLayout projectedLayout(EditorToolContext ctx) {
        if (ctx != null && ctx.projectedLayout() != null) {
            return ctx.projectedLayout();
        }
        DungeonLayout layout = mapState.activeMap();
        if (layout == null) {
            return DungeonLayout.empty();
        }
        return layout.projectedToLevel(mapState.activeProjectionLevel());
    }

    private EditorDraft.CorridorDraft corridorDraft() {
        return state.activeDraft() instanceof EditorDraft.CorridorDraft draft ? draft : null;
    }

    private void clear() {
        state.clearDraft();
        refreshStatePane();
    }

    private void refreshStatePane() {
        if (activeTool != null) {
            refreshCallback.run();
        }
    }

    private String corridorStatusText() {
        if (activeTool == null) {
            return null;
        }
        EditorDraft.CorridorDraft draft = corridorDraft();
        if (draft != null && draft.pendingStart() != null) {
            String startLabel = draft.pendingStart().displayLabel();
            return (startLabel == null || startLabel.isBlank() ? "Start gewählt" : "Start: " + startLabel)
                    + " auf z=" + draft.pendingStart().levelZ()
                    + ", Zielraum oder Korridor anklicken";
        }
        String selectedTargetKey = state.selectedTargetKey();
        if (Corridor.isTargetKey(selectedTargetKey)) {
            Long corridorId = Corridor.corridorIdFromKey(selectedTargetKey);
            return "Gewählt: " + (corridorId == null ? "Korridor" : "Korridor " + corridorId);
        }
        return null;
    }
}
