package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.traversal.DungeonTraversalEditService;
import features.world.dungeonmap.application.traversal.TraversalSegmentRef;
import features.world.dungeonmap.application.traversal.TraversalTarget;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorDraft;
import features.world.dungeonmap.state.EditorInteractionState;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.async.UiErrorReporter;

import java.util.Objects;
import java.util.Set;

public final class TraversalTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final DungeonTraversalEditService traversalEditService;
    private final EditorInteractionState state;
    private final DungeonGridHitTester hitTester = new DungeonGridHitTester();
    private final Label statusLabel = new Label("Keine Verbindung gewählt");
    private final VBox statusCard = EditorCards.card("Verbindung", statusLabel);

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };

    public TraversalTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            DungeonTraversalEditService traversalEditService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.traversalEditService = Objects.requireNonNull(traversalEditService, "traversalEditService");
        this.state = Objects.requireNonNull(state, "state");
        this.statusLabel.setWrapText(true);
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.TRAVERSAL_CREATE, DungeonEditorTool.TRAVERSAL_DELETE);
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
            case TRAVERSAL_CREATE -> handleCreatePressed(ctx, event);
            case TRAVERSAL_DELETE -> handleDeletePressed(ctx, event);
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
        String statusText = traversalStatusText();
        if (statusText == null || statusText.isBlank()) {
            statusLabel.setText("Keine Verbindung gewählt");
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
        DungeonLayout projected = ctx.projectedLayout();
        DungeonEditorHitTarget hit = hitTester.hitTest(projected, event.canvasPoint(), event.camera());
        EditorDraft.PendingTarget target = resolveTarget(hit, event.gridCell(), projected, mapState.activeProjectionLevel());
        if (target == null) {
            clear();
            state.clearSelection();
            return false;
        }
        state.selectTarget(target.targetKey());
        EditorDraft.CorridorDraft draft = traversalDraft();
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
        loadingService.submitReloadingWrite(
                () -> applyCreateAction(mapId, start.target(), target),
                mapId,
                null,
                throwable -> UiErrorReporter.reportBackgroundFailure("TraversalTool.handleCreatePressed()", throwable));
        return true;
    }

    private boolean handleDeletePressed(EditorToolContext ctx, DungeonCanvasPointerEvent event) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || event.gridCell() == null) {
            return false;
        }
        DungeonLayout projected = ctx.projectedLayout();
        DungeonStair stair = projected.stairsAtCell(event.gridCell(), mapState.activeProjectionLevel()).stream()
                .filter(candidate -> candidate != null && candidate.stairId() != null)
                .findFirst()
                .orElse(null);
        if (stair != null && stair.stairId() != null) {
            state.selectTarget(stair.targetKey());
            clear();
            loadingService.submitReloadingWrite(
                    () -> traversalEditService.deleteBySegment(projected, new TraversalSegmentRef.StairSegment(stair.stairId())),
                    mapId,
                    null,
                    throwable -> UiErrorReporter.reportBackgroundFailure("TraversalTool.handleDeletePressed()", throwable));
            return true;
        }
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
        loadingService.submitReloadingWrite(
                () -> traversalEditService.deleteBySegment(projected, new TraversalSegmentRef.CorridorSegment(corridor.corridorId())),
                mapId,
                null,
                throwable -> UiErrorReporter.reportBackgroundFailure("TraversalTool.handleDeletePressed()", throwable));
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
        traversalEditService.create(layout, toTraversalTarget(start), toTraversalTarget(target));
    }

    private static TraversalTarget toTraversalTarget(EditorDraft.PendingTarget target) {
        if (target instanceof EditorDraft.PendingTarget.Room room) {
            return new TraversalTarget.Room(room.roomId(), room.targetKey());
        }
        if (target instanceof EditorDraft.PendingTarget.Corridor corridor) {
            return new TraversalTarget.CorridorSegment(corridor.corridorId(), corridor.targetKey());
        }
        if (target instanceof EditorDraft.PendingTarget.Stair stair) {
            return new TraversalTarget.StairSegment(stair.stairId(), stair.targetKey());
        }
        return null;
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
        if (target instanceof EditorDraft.PendingTarget.Stair stairTarget) {
            return stairTarget.stairId() == null ? "Treppe" : "Treppe " + stairTarget.stairId();
        }
        return "Ziel";
    }

    private static EditorDraft.PendingTarget resolveTarget(
            DungeonEditorHitTarget hit,
            features.world.dungeonmap.model.geometry.Point2i gridCell,
            DungeonLayout layout,
            int levelZ
    ) {
        Long roomId = singleRoomIdFor(hit, layout);
        if (roomId != null && hit != null) {
            return new EditorDraft.PendingTarget.Room(roomId, hit.targetKey());
        }
        if (layout == null || gridCell == null) {
            return null;
        }
        DungeonStair stair = layout.stairsAtCell(gridCell, levelZ).stream()
                .filter(candidate -> candidate != null && candidate.stairId() != null)
                .findFirst()
                .orElse(null);
        if (stair != null) {
            return new EditorDraft.PendingTarget.Stair(stair.stairId(), stair.targetKey());
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

    private EditorDraft.CorridorDraft traversalDraft() {
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

    private String traversalStatusText() {
        EditorDraft.CorridorDraft draft = traversalDraft();
        if (draft == null || draft.pendingStart() == null || draft.pendingStart().displayLabel() == null) {
            return null;
        }
        return "Start: " + draft.pendingStart().displayLabel();
    }
}
